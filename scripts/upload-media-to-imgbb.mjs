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

const mediaMap = {
  "corte-autoridad.jpg": "haircut",
  "haircut-eyebrows.png": "haircut-eyebrows",
  "experiencia-dominante.jpg": "haircut-beard",
  "corte-diseño-cejas.jpg": "haircut-design",
  "rostro-impecable.jpg": "haircut-facial-mask",
  "barba.jpg": "beard-combo",
  "nuestro-equipo-alan.jpg": "team-alan",
  "nuestro-equipo-stiven.png": "team-stiven",
  "logo-barber.jpg": "logo",
};

async function uploadToImgBB(filePath, fileName) {
  try {
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString("base64");

    const formData = new URLSearchParams();
    formData.append("image", base64Data);
    formData.append("name", path.parse(fileName).name);

    console.log(`📤 Subiendo ${fileName} a ImgBB...`);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (json.success && json.data?.url) {
      console.log(`✅ ${fileName} subido con éxito: ${json.data.url}`);
      return json.data.url;
    } else {
      console.error(`❌ Error al subir ${fileName}:`, json);
      return null;
    }
  } catch (err) {
    console.error(`❌ Excepción al subir ${fileName}:`, err);
    return null;
  }
}

async function run() {
  console.log("🚀 Iniciando migración de medios a CDN de ImgBB...");
  const multimediaDir = path.resolve("public/multimedia");
  const cdnMapping = {};

  for (const [fileName, identifier] of Object.entries(mediaMap)) {
    const localPath = path.join(multimediaDir, fileName);
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ Archivo no encontrado localmente: ${localPath}`);
      continue;
    }

    const cdnUrl = await uploadToImgBB(localPath, fileName);
    if (cdnUrl) {
      cdnMapping[fileName] = cdnUrl;
      cdnMapping[identifier] = cdnUrl;
    }
    // Pausa breve para evitar rate limit de ImgBB
    await new Promise(r => setTimeout(r, 600));
  }

  // Guardar mapeo en disco
  fs.writeFileSync("scripts/cdn-mapping.json", JSON.stringify(cdnMapping, null, 2), "utf-8");
  console.log("💾 Mapeo de CDN guardado en scripts/cdn-mapping.json");

  // Actualizar colección de servicios en Firestore
  console.log("🔄 Actualizando servicios en Firestore con URLs de CDN...");
  const servicesSnap = await getDocs(collection(db, "services"));
  for (const docSnap of servicesSnap.docs) {
    const data = docSnap.data();
    const serviceId = docSnap.id;
    
    // Buscar si tenemos URL de CDN para este servicio
    let newUrl = null;
    if (cdnMapping[serviceId]) {
      newUrl = cdnMapping[serviceId];
    } else if (data.mediaUrl) {
      const baseName = path.basename(data.mediaUrl);
      if (cdnMapping[baseName]) {
        newUrl = cdnMapping[baseName];
      }
    }

    if (newUrl) {
      await updateDoc(doc(db, "services", serviceId), { mediaUrl: newUrl });
      console.log(`✨ Servicio '${data.name}' (${serviceId}) actualizado con CDN: ${newUrl}`);
    }
  }

  // Actualizar miembros de equipo en Firestore
  console.log("🔄 Actualizando equipo en Firestore con URLs de CDN...");
  const teamSnap = await getDocs(collection(db, "team"));
  for (const docSnap of teamSnap.docs) {
    const data = docSnap.data();
    const barberId = docSnap.id;
    let newUrl = null;

    if (data.name?.toLowerCase().includes("alan") && cdnMapping["team-alan"]) {
      newUrl = cdnMapping["team-alan"];
    } else if (data.name?.toLowerCase().includes("stiven") && cdnMapping["team-stiven"]) {
      newUrl = cdnMapping["team-stiven"];
    } else if (data.imageUrl) {
      const baseName = path.basename(data.imageUrl);
      if (cdnMapping[baseName]) {
        newUrl = cdnMapping[baseName];
      }
    }

    if (newUrl) {
      await updateDoc(doc(db, "team", barberId), { imageUrl: newUrl });
      console.log(`✨ Barbero '${data.name}' actualizado con CDN: ${newUrl}`);
    }
  }

  console.log("🎉 ¡Migración de medios a CDN completada con éxito!");
  process.exit(0);
}

run();
