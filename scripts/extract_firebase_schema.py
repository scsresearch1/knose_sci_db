#!/usr/bin/env python3
"""
Temporary script to read from Firebase Realtime Database and extract the schema.
Uses REST API - no auth needed if database rules allow read.

Usage: python scripts/extract_firebase_schema.py
       python scripts/extract_firebase_schema.py --output schema.json  # Save to file
"""

import json
import re
import requests
import sys
from collections import defaultdict
from typing import Any

FIREBASE_URL = "https://knose-e1959-default-rtdb.firebaseio.com"


def fetch(path: str = "", shallow: bool = False, timeout: int = 120) -> Any:
    """Fetch data from Firebase REST API."""
    url = f"{FIREBASE_URL}/{path}.json"
    if shallow:
        url += "?shallow=true"
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"Error fetching {path}: {e}")
        return None


def infer_type(value: Any) -> str:
    """Infer type of a value."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    return "unknown"


def extract_complete_schema(data: Any) -> dict:
    """
    Load full data and extract complete schema by walking entire structure.
    Aggregates all unique keys at each level across the entire database.
    """
    schema = {
        "structure": "Device_X / BME_XX / HP_XXX / timestamp / { record }",
        "levels": {},
        "record_fields": None,
        "stats": {"total_devices": 0, "total_sensors": 0, "total_hps": 0, "total_records": 0},
    }

    if not data or not isinstance(data, dict):
        return schema

    all_devices = set()
    all_sensors = set()
    all_hps = set()
    timestamp_pattern = None
    record_fields = set()
    total_records = 0

    # Timestamp pattern: YYYY-MM-DD_HH-MM-SS_nanoseconds
    ts_regex = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d+$")

    for device_id, device_data in data.items():
        all_devices.add(device_id)
        if not isinstance(device_data, dict):
            continue

        for sensor_id, sensor_data in device_data.items():
            all_sensors.add(sensor_id)
            if not isinstance(sensor_data, dict):
                continue

            for hp_id, hp_data in sensor_data.items():
                all_hps.add(hp_id)
                if not isinstance(hp_data, dict):
                    continue

                for ts_key, record in hp_data.items():
                    if ts_regex.match(ts_key):
                        timestamp_pattern = "YYYY-MM-DD_HH-MM-SS_nanoseconds"
                    total_records += 1
                    if isinstance(record, dict):
                        record_fields.update(record.keys())

    schema["levels"]["root"] = {
        "keys": sorted(all_devices),
        "count": len(all_devices),
        "type": "object",
        "description": "Device IDs (Device_1, Device_2, ...)",
    }
    schema["levels"]["device"] = {
        "keys": sorted(all_sensors),
        "count": len(all_sensors),
        "type": "object",
        "description": "Sensor IDs (BME_01 to BME_16)",
    }
    schema["levels"]["sensor"] = {
        "keys": sorted(all_hps),
        "count": len(all_hps),
        "type": "object",
        "description": "Heater Profile IDs (Hp_301, Hp_322, ...)",
    }
    schema["levels"]["hp"] = {
        "key_pattern": timestamp_pattern or "string",
        "type": "object",
        "description": "Timestamp keys (YYYY-MM-DD_HH-MM-SS_nanoseconds)",
    }
    schema["record_fields"] = {
        "keys": sorted(record_fields),
        "count": len(record_fields),
        "description": "Fields in each reading record",
    }

    # Get sample record with types
    sample_record = None
    for device_id, device_data in data.items():
        if not isinstance(device_data, dict):
            continue
        for sensor_id, sensor_data in device_data.items():
            if not isinstance(sensor_data, dict):
                continue
            for hp_id, hp_data in sensor_data.items():
                if not isinstance(hp_data, dict):
                    continue
                for ts_key, record in hp_data.items():
                    if isinstance(record, dict) and record:
                        sample_record = {k: {"type": infer_type(v), "sample": v} for k, v in record.items()}
                        break
                if sample_record:
                    break
            if sample_record:
                break
        if sample_record:
            break

    schema["record_fields"]["field_types"] = sample_record or {}

    schema["stats"]["total_devices"] = len(all_devices)
    schema["stats"]["total_sensors"] = len(all_sensors)
    schema["stats"]["total_hps"] = len(all_hps)
    schema["stats"]["total_records"] = total_records

    return schema


def build_detailed_schema(data: Any, path: str = "", depth: int = 0) -> dict:
    """Build detailed schema with full key lists at each level. Limits recursion at timestamp level."""
    if not data:
        return {"_type": "null", "_path": path}

    if isinstance(data, dict):
        keys = list(data.keys())
        # For timestamp level (keys like 2026-02-02_09-38-35_398398000), sample ONE record only
        if keys and re.match(r"^\d{4}-\d{2}-\d{2}_", str(keys[0])):
            sample_ts = keys[0]
            sample_record = data[sample_ts]
            record_schema = build_detailed_schema(sample_record, f"{path}/{sample_ts}", depth + 1) if isinstance(sample_record, dict) else {"_type": infer_type(sample_record)}
            return {
                "_path": path,
                "_type": "object",
                "_key_pattern": "YYYY-MM-DD_HH-MM-SS_nanoseconds",
                "_key_count": len(keys),
                "_sample_keys": keys[:3],
                "_record_schema": record_schema,
            }
        # For record level (sensor reading - all values are primitives, not nested objects)
        if keys and all(not isinstance(data[k], (dict, list)) for k in keys):
            return {
                "_path": path,
                "_type": "object",
                "_keys": sorted(keys),
                "_field_types": {k: infer_type(data[k]) for k in keys},
                "_sample_values": {k: data[k] for k in keys},
            }
        # For other levels (devices, sensors, HPs), recurse into all children
        children = {}
        for key in sorted(keys):
            child_path = f"{path}/{key}" if path else key
            children[key] = build_detailed_schema(data[key], child_path, depth + 1)
        return {
            "_path": path,
            "_type": "object",
            "_keys": sorted(keys),
            "_key_count": len(keys),
            "_children": children,
        }

    return {"_path": path, "_type": infer_type(data), "_sample": data}


def print_schema(schema: Any, indent: int = 0, max_children: int = 15) -> None:
    """Pretty print schema."""
    prefix = "  " * indent
    if isinstance(schema, dict):
        for k, v in schema.items():
            if k == "_path":
                continue
            if k == "_children" and isinstance(v, dict):
                print(f"{prefix}children ({len(v)} items):")
                for i, (ck, cv) in enumerate(v.items()):
                    if i >= max_children:
                        print(f"{prefix}  ... +{len(v) - max_children} more")
                        break
                    print(f"{prefix}  [{ck}]:")
                    print_schema(cv, indent + 2, max_children)
            elif isinstance(v, dict) and not any(x in v for x in ("_type", "_keys", "keys", "count")):
                print(f"{prefix}{k}:")
                print_schema(v, indent + 1, max_children)
            elif isinstance(v, (list, dict)) and k not in ("_children",):
                val_str = json.dumps(v, default=str, indent=2)
                if len(val_str) > 200:
                    val_str = val_str[:197] + "..."
                print(f"{prefix}{k}: {val_str}")
            else:
                val_str = str(v)
                if len(val_str) > 120:
                    val_str = val_str[:117] + "..."
                print(f"{prefix}{k}: {val_str}")
    else:
        print(f"{prefix}{schema}")


def main():
    output_file = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_file = sys.argv[idx + 1]

    print("=" * 70)
    print("Firebase Realtime Database - COMPLETE SCHEMA EXTRACTION")
    print(f"URL: {FIREBASE_URL}")
    print("Loading FULL data (this may take a moment for large databases)...")
    print("=" * 70)

    # Load FULL data
    full_data = fetch("", shallow=False, timeout=180)
    if full_data is None:
        print("Failed to load data.")
        return

    data_size_mb = len(json.dumps(full_data)) / (1024 * 1024)
    print(f"\nData loaded: ~{data_size_mb:.2f} MB\n")

    # Extract complete aggregated schema
    print("--- COMPLETE SCHEMA (aggregated across full database) ---\n")
    complete_schema = extract_complete_schema(full_data)
    print_schema(complete_schema)

    # Detailed schema (full structure with all keys)
    print("\n--- DETAILED SCHEMA (full structure) ---\n")
    detailed_schema = build_detailed_schema(full_data, "root")
    print_schema(detailed_schema, max_children=15)

    result = {
        "complete_schema": complete_schema,
        "detailed_schema": detailed_schema,
    }

    if output_file:
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nSchema saved to: {output_file}")

    print("\n" + "=" * 70)
    print("Done.")
    print("=" * 70)


if __name__ == "__main__":
    main()
