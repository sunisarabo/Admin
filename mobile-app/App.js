import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "xxx",
  authDomain: "xxx",
  projectId: "xxx"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });

    const unsub = onSnapshot(collection(db, 'assignments'), (snap) => {
      setData(snap.docs.map(d => d.data()));
    });

    return () => unsub();
  }, []);

  return (
    <View style={{padding:40}}>
      <Text>Mobile Roster</Text>
      {data.map((d,i) => (
        <Text key={i}>{d.flight} - {d.team}</Text>
      ))}
    </View>
  );
}
