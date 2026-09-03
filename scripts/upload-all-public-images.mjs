process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, getDocs, collection } from "firebase/firestore";

const IMGBB_API_KEY = "ee478f85a2e97387a2e9a62d2b984e48";

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

const multimediaFiles = [
  "barba.jpg",
  "corte-autoridad.jpg",
  "corte-diseño-cejas.jpg",
  "experiencia-dominante.jpg",
  "haircut-eyebrows.png",
  "logo-barber.jpg",
  "rostro-impecable.jpg",
  "servicio-premium.jpg",
  "sobre-nosotros.jpg",
  "Ubicación.png",
  "¡Cita Confirmada!.png"
];

async function uploadToImgBB(filePath, fileName) {
  try {
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString("base64");

    const formData = new URLSearchParams();
    formData.append("image", base64Data);
    formData.append("name", path.parse(fileName).name);

    console.log(`📤 Subiendo ${fileName} (${(fileData.length / 1024 / 1024).toFixed(2)} MB) a ImgBB...`);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (json.success && json.data?.url) {
      console.log(`✅ ${fileName} => ${json.data.url}`);
      return json.data.url;
    } else {
      console.error(`❌ Error en ${fileName}:`, json);
      return null;
    }
  } catch (err) {
    console.error(`❌ Excepción al subir ${fileName}:`, err);
    return null;
  }
}

async function run() {
  console.log("🚀 Iniciando subida de TODAS las fotos de public/ a tu cuenta de ImgBB...");
  const multimediaDir = path.resolve("public/multimedia");
  const cdnResults = {};

  for (const fileName of multimediaFiles) {
    const filePath = path.join(multimediaDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Archivo no encontrado: ${fileName}`);
      continue;
    }

    const url = await uploadToImgBB(filePath, fileName);
    if (url) {
      cdnResults[fileName] = url;
    }
    // Pausa breve para evitar saturar el endpoint de ImgBB
    await new Promise(r => setTimeout(r, 600));
  }

  fs.writeFileSync("scripts/all-imgbb-urls.json", JSON.stringify(cdnResults, null, 2), "utf-8");
  console.log("\n💾 Resultados guardados en scripts/all-imgbb-urls.json\n");

  // Mapeo de servicios a URLs de ImgBB
  const serviceToFileName = {
    "haircut": "corte-autoridad.jpg",
    "haircut-eyebrows": "haircut-eyebrows.png",
    "haircut-beard": "experiencia-dominante.jpg",
    "haircut-design": "corte-diseño-cejas.jpg",
    "haircut-facial-mask": "rostro-impecable.jpg",
    "beard-combo": "barba.jpg",
    "eyebrows": "haircut-eyebrows.png",
  };

  console.log("🔄 Actualizando servicios en Firestore con las URLs de ImgBB...");
  const snap = await getDocs(collection(db, "services"));
  for (const docSnap of snap.docs) {
    const id = docSnap.id;
    const targetFile = serviceToFileName[id];
    if (targetFile && cdnResults[targetFile]) {
      const imgbbUrl = cdnResults[targetFile];
      await updateDoc(doc(db, "services", id), {
        mediaUrl: imgbbUrl,
        updatedAt: new Date(),
      });
      console.log(`✨ Servicio '${id}' actualizado en Firestore => ${imgbbUrl}`);
    }
  }

  console.log("\n🎉 ¡Todas las fotos de tu carpeta public quedaron en tu cuenta de ImgBB y conectadas a Firestore!");
  process.exit(0);
}

run();
