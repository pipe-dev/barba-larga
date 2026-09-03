process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, getDocs, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcGUogatGkZ_4GJlXuykdE44omkcjcbpM",
  authDomain: "barba-larga-app-v2.firebaseapp.com",
  projectId: "barba-larga-app-v2",
  storageBucket: "barba-larga-app-v2.appspot.com",
  messagingSenderId: "895613741495",
  appId: "1:895613741495:web:2ca5d8ce7757d5fd112032",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const realWebImages = {
  "haircut": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
  "haircut-eyebrows": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80",
  "haircut-beard": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80",
  "haircut-design": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
  "haircut-facial-mask": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
  "beard-combo": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=80",
  "eyebrows": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
};

async function update() {
  console.log("🔄 Actualizando servicios en Firestore con URLs reales de alta definición...");
  const snap = await getDocs(collection(db, "services"));

  for (const docSnap of snap.docs) {
    const serviceId = docSnap.id;
    const url = realWebImages[serviceId];
    if (url) {
      await updateDoc(doc(db, "services", serviceId), {
        mediaUrl: url,
        updatedAt: new Date(),
      });
      console.log(`✅ Servicio '${serviceId}' actualizado con URL web real: ${url}`);
    }
  }

  console.log("✨ Todos los servicios fueron actualizados con fotos reales de barbería.");
  process.exit(0);
}

update();
