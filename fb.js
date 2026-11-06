// Ponte entre o Km Líquido e o Firebase (login por e-mail e senha + banco Firestore com cache offline).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, where, writeBatch, FieldPath, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuração do projeto Firebase (cole aqui o firebaseConfig do console). Não é senha.
const CONFIG = {
  apiKey: 'AIzaSyCxFX-bSIaaMmqx62w2a29wIq32x5_NitQ',
  authDomain: 'km-liquido.firebaseapp.com',
  projectId: 'km-liquido',
  storageBucket: 'km-liquido.firebasestorage.app',
  messagingSenderId: '1051328812430',
  appId: '1:1051328812430:web:7cbefe516db6ca9d66c0df',
};

let auth = null, db = null;
if (CONFIG) {
  const app = initializeApp(CONFIG);
  auth = getAuth(app);
  try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
}

// [[['config','fixos','seguroAnual'], '3200'], ...] -> FieldPath, valor, FieldPath, valor...
const achatar = (pares) => pares.flatMap(([caminho, valor]) => [new FieldPath(...caminho), valor]);
const carroRef = (id) => doc(db, 'carros', id);

export const FB = {
  configurado: !!CONFIG,
  onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email || '' } : null)); },
  entrar: (email, senha) => signInWithEmailAndPassword(auth, email, senha),
  criarConta: (email, senha) => createUserWithEmailAndPassword(auth, email, senha),
  recuperar: (email) => sendPasswordResetEmail(auth, email),
  sair: () => signOut(auth),

  async meusCarros(uid) {
    const qs = await getDocs(query(collection(db, 'carros'), where('membros', 'array-contains', uid)));
    return qs.docs.map((d) => ({ id: d.id, data: d.data() }));
  },
  ouvirCarro(id, cb, err) {
    return onSnapshot(carroRef(id), { includeMetadataChanges: true },
      (s) => cb({ exists: s.exists(), data: s.exists() ? s.data() : null, pendente: s.metadata.hasPendingWrites, cache: s.metadata.fromCache }), err);
  },
  ouvirCol(id, col, cb, err) {
    return onSnapshot(collection(db, 'carros', id, col), { includeMetadataChanges: true }, (s) => {
      const docs = {};
      s.forEach((d) => { docs[d.id] = d.data(); });
      cb({ docs, pendente: s.metadata.hasPendingWrites, cache: s.metadata.fromCache });
    }, err);
  },
  novoId: () => doc(collection(db, 'carros')).id,
  criarCarro: (id, data) => setDoc(carroRef(id), data),
  updCarro: (id, pares) => updateDoc(carroRef(id), ...achatar(pares)),
  setItem: (id, col, itemId, data) => setDoc(doc(db, 'carros', id, col, itemId), data),
  updItem: (id, col, itemId, pares) => updateDoc(doc(db, 'carros', id, col, itemId), ...achatar(pares)),
  delItem: (id, col, itemId) => deleteDoc(doc(db, 'carros', id, col, itemId)),

  async lerConvite(codigo) {
    const s = await getDoc(doc(db, 'convites', codigo));
    return s.exists() ? s.data().carroId : null;
  },
  criarConvite: (codigo, carroId) => setDoc(doc(db, 'convites', codigo), { carroId }),
  apagarConvite: (codigo) => deleteDoc(doc(db, 'convites', codigo)),
  entrarNoCarro: (carroId, uid, email, codigo) => updateDoc(carroRef(carroId),
    'membros', arrayUnion(uid), 'entrada', codigo, new FieldPath('contas', uid), { email }),

  async apagarCarro(id, codigo) {
    for (const col of ['usos', 'gastos', 'pagamentos']) {
      const qs = await getDocs(collection(db, 'carros', id, col));
      let lote = writeBatch(db), n = 0;
      for (const d of qs.docs) {
        lote.delete(d.ref);
        if (++n === 400) { await lote.commit(); lote = writeBatch(db); n = 0; }
      }
      if (n) await lote.commit();
    }
    if (codigo) { try { await deleteDoc(doc(db, 'convites', codigo)); } catch (e) { /* já apagado */ } }
    await deleteDoc(carroRef(id));
  },
};
