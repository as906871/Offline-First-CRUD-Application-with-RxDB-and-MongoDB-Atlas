import React, { useEffect, useState, useCallback } from "react";
import { getDatabase } from "./database/db";
import { startReplication } from "./services/replicate";

function App() {
  const [db, setDb] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [articles, setArticles] = useState([]);
  const [businessName, setBusinessName] = useState("");
  const [article, setArticle] = useState({ name: "", qty: 0, selling_price: 0, business_id: "" });
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState(null);

  const SERVER_URL = "http://localhost:3001";


  const initializeApp = useCallback(async () => {
    try {
      setStatus("Connecting to database...");
      const _db = await getDatabase();
      if (!_db.businesses || !_db.articles) throw new Error("Collections not found");

      setDb(_db);

      const subBusinesses = _db.businesses.find().sort({ updatedAt: 1 }).$.subscribe(rows => setBusinesses(rows.map(r => r.toJSON())));
      const subArticles = _db.articles.find().sort({ updatedAt: 1 }).$.subscribe(rows => setArticles(rows.map(r => r.toJSON())));

      setStatus("Setting up replication...");

      await startReplication(_db, "businesses", SERVER_URL);
      await startReplication(_db, "articles", SERVER_URL);

      setStatus("Connected and Replicating ✅");

      return () => {
        subBusinesses.unsubscribe();
        subArticles.unsubscribe();
      };
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatus("Error");
    }
  }, []);

  useEffect(() => {
    let cleanup;
    initializeApp().then(fn => { cleanup = fn; });
    return () => cleanup?.();
  }, [initializeApp]);

  const addBusiness = async (e) => {
    e.preventDefault();
    if (!db || !businessName.trim()) return;
    const data = { id: crypto.randomUUID(), name: businessName.trim(), updatedAt: new Date().toISOString() };
    await db.businesses.insert(data);
    setBusinessName("");
  };

const updateBusiness = async (id, newName) => {
  if (!db) return;
  const doc = await db.businesses.findOne({ selector: { id } }).exec();
  if (doc) {
    await doc.patch({
      name: newName,
      updatedAt: new Date().toISOString(),
    });
  }
};

 const deleteBusiness = async (id) => {
  if (!db) return;
  const doc = await db.businesses.findOne({ selector: { id } }).exec();
  if (doc) {
    await doc.remove();
  }
};

  const addArticle = async (e) => {
    e.preventDefault();
    if (!db || !article.name.trim() || !article.business_id) return;
    const data = { ...article, id: crypto.randomUUID(), qty: Number(article.qty), selling_price: Number(article.selling_price), updatedAt: new Date().toISOString() };
    await db.articles.insert(data);
    setArticle({ name: "", qty: 0, selling_price: 0, business_id: "" });
  };

const updateArticle = async (id, updates) => {
  const doc = await db.articles.findOne({ selector: { id } }).exec();
  if (doc) {
    await doc.patch({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }
};

const deleteArticle = async (id) => {
  const doc = await db.articles.findOne({ selector: { id } }).exec();
  if (doc) {
    await doc.remove();
  }
};
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CRUD Operation online or offline</h1>
      <div className="mb-6 p-4 rounded border">
        <span className={`text-sm font-medium ${status.includes("Connected") ? "text-green-600" : "text-blue-600"}`}>Status: {status}</span>
        {error && <div className="mt-2 text-red-600">{error}</div>}
      </div>

      <form onSubmit={addBusiness} className="mb-6 flex gap-2">
        <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Business name" className="border p-2 flex-1 rounded" required />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add Business</button>
      </form>

      <form onSubmit={addArticle} className="mb-6 grid grid-cols-2 gap-2">
        <input placeholder="Article name" value={article.name} onChange={e => setArticle({ ...article, name: e.target.value })} className="border p-2 rounded" required />
        <input type="number" min="0" placeholder="Quantity" value={article.qty} onChange={e => setArticle({ ...article, qty: Number(e.target.value) })} className="border p-2 rounded" required />
        <input type="number" min="0" step="0.01" placeholder="Selling price" value={article.selling_price} onChange={e => setArticle({ ...article, selling_price: Number(e.target.value) })} className="border p-2 rounded" required />
        <select value={article.business_id} onChange={e => setArticle({ ...article, business_id: e.target.value })} className="border p-2 rounded col-span-2" required>
          <option value="">Select business</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded col-span-2">Add Article</button>
      </form>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Businesses ({businesses.length})</h2>
        <ul className="space-y-2">
          {businesses.map(b => (
            <li key={b.id} className="border p-2 rounded flex justify-between items-center">
              <span>{b.name}</span>
              <div className="flex gap-2">
                <button onClick={() => {
                  const newName = prompt("Enter new business name:", b.name);
                  if (newName) updateBusiness(b.id, newName);
                }} className="bg-yellow-500 text-white px-2 py-1 rounded">Edit</button>
                <button onClick={() => deleteBusiness(b.id)} className="bg-red-600 text-white px-2 py-1 rounded">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Articles ({articles.length})</h2>
        <ul className="space-y-2">
          {articles.map(a => (
            <li key={a.id} className="border p-2 rounded flex justify-between items-center">
              <span>{a.name} (Qty: {a.qty}, Price: {a.selling_price}, Business: {businesses.find(b => b.id === a.business_id)?.name || "N/A"})</span>
              <div className="flex gap-2">
                <button onClick={() => {
                  const newName = prompt("Enter new article name:", a.name);
                  const newQty = prompt("Enter new quantity:", a.qty);
                  const newPrice = prompt("Enter new selling price:", a.selling_price);
                  if (newName && newQty && newPrice) {
                    updateArticle(a.id, { name: newName, qty: Number(newQty), selling_price: Number(newPrice) });
                  }
                }} className="bg-yellow-500 text-white px-2 py-1 rounded">Edit</button>
                <button onClick={() => deleteArticle(a.id)} className="bg-red-600 text-white px-2 py-1 rounded">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;