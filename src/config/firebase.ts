import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  databaseURL: 'https://knose-e1959-default-rtdb.firebaseio.com/'
}

export const DATABASE_URL = firebaseConfig.databaseURL

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app)

export default app

