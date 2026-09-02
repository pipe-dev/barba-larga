import { initializeApp } from "firebase/app";
import { getFirestore, doc, writeBatch, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCcGUogatGkZ_4GJlXuykdE44omkcjcbpM",
  authDomain: "barba-larga-app-v2.firebaseapp.com",
  projectId: "barba-larga-app-v2",
  storageBucket: "barba-larga-app-v2.appspot.com",
  messagingSenderId: "895613741495",
  appId: "1:895613741495:web:2ca5d8ce7757d5fd112032",
  measurementId: "G-0D558F6DVS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const services = [
  {
    id: "haircut",
    name: "Corte de cabello",
    description: "Un corte preciso que define tu estilo y resalta tus mejores rasgos. Sal con una nueva actitud.",
    price: "25000",
    duration: 60,
    icon: "Scissors",
    mediaUrl: "/multimedia/corte-autoridad.jpg",
    mediaType: "image",
    imageHint: "male classic haircut"
  },
  {
    id: "haircut-eyebrows",
    name: "Corte de cabello con ceja",
    description: "El look completo. Un corte impecable complementado con un perfilado de cejas profesional para enmarcar tu mirada.",
    price: "26000",
    duration: 70,
    icon: "Scissors",
    mediaUrl: "/multimedia/haircut-eyebrows.png",
    mediaType: "image",
    imageHint: "haircut and eyebrows"
  },
  {
    id: "haircut-beard",
    name: "Corte de cabello con Barba",
    description: "La transformación total. Un corte de precisión y un diseño de barba que proyectan poder y sofisticación.",
    price: "35000",
    duration: 90,
    icon: "BeardIcon",
    mediaUrl: "/multimedia/experiencia-dominante.jpg",
    mediaType: "image",
    imageHint: "beard trim"
  },
  {
    id: "haircut-design",
    name: "Corte de cabello con diseño",
    description: "Tu estilo, tu lienzo. Un corte de precisión acompañado de un diseño creativo para expresar tu individualidad.",
    price: "30000",
    duration: 80,
    icon: "PencilRuler",
    mediaUrl: "/multimedia/corte-diseño-cejas.jpg",
    mediaType: "image",
    imageHint: "hair design"
  },
  {
    id: "haircut-facial-mask",
    name: "Corte de cabello más mascarilla de exfoliación",
    description: "Renueva tu look y tu piel. Un corte perfecto junto con una mascarilla que elimina impurezas y revitaliza tu rostro.",
    price: "32000",
    duration: 75,
    icon: "Droplets",
    mediaUrl: "/multimedia/rostro-impecable.jpg",
    mediaType: "image",
    imageHint: "facial treatment"
  },
  {
    id: "beard-combo",
    name: "Barba combo",
    description: "Una barba impecable es tu mejor carta de presentación. Incluye limpieza, exfoliación y un delineado perfecto.",
    price: "16000",
    duration: 40,
    icon: "User",
    mediaUrl: "/multimedia/barba.jpg",
    mediaType: "image",
    imageHint: "beard detailing"
  },
  {
    id: "eyebrows",
    name: "Cejas con cuchilla",
    description: "Define y perfecciona tus cejas con la precisión de la cuchilla para una mirada más nítida y marcada.",
    price: "4000",
    duration: 20,
    icon: "PencilRuler",
    mediaUrl: "/multimedia/haircut-eyebrows.png",
    mediaType: "image",
    imageHint: "eyebrow shaping"
  }
];

async function seed() {
  console.log("Seeding all 7 services to Firestore (barba-larga-app-v2)...");
  const batch = writeBatch(db);
  const servicesRef = collection(db, "services");

  for (const s of services) {
    const sRef = doc(servicesRef, s.id);
    batch.set(sRef, {
      ...s,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await batch.commit();
  console.log("SUCCESS! All 7 services committed to Firestore.");

  const check = await getDocs(servicesRef);
  console.log(`Verification: Found ${check.size} services in Firestore:`);
  check.docs.forEach(d => console.log(` - ${d.id}: ${d.data().name} ($${d.data().price}, ${d.data().duration} min)`));
}

seed().then(() => process.exit(0)).catch(err => {
  console.error("Error seeding:", err);
  process.exit(1);
});
