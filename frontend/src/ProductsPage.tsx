import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { api } from './core';

type Medication = {
  id: string;
  name: string;
  strength: string;
  quantity_label?: string;
  aka?: string;
  category?: string;
  store_count?: number;
};

export function ProductsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(new URLSearchParams(location.search).get('category') || 'All products');
  const [status, setStatus] = useState('Loading products…');
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let active = true;
    api<{ medications: Medication[] }>('/api/medications')
      .then((response) => {
        if (!active) return;
        setMedications(response.medications);
        setStatus('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : 'Could not load the product list.');
      });
    return () => { active = false; };
  }, [request]);

  const categories = useMemo(() => ['All products', ...Array.from(new Set(medications.map((item) => item.category).filter((value): value is string => Boolean(value)))).sort()], [medications]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return medications.filter((item) => {
      const categoryMatches = category === 'All products' || item.category === category;
      const searchMatches = !normalized || [item.name, item.strength, item.quantity_label, item.aka, item.category].some((field) => field?.toLowerCase().includes(normalized));
      return categoryMatches && searchMatches;
    }).sort((left, right) => left.name.localeCompare(right.name) || left.strength.localeCompare(right.strength));
  }, [medications, query, category]);

  return <AppShell active="products"><main className="screen active catalog-page">
    <div className="catalog-heading">
      <div><div className="eyebrow">Browse OTC</div><h1>Product list</h1><p className="lead">Find a medication by its common name, ingredient, or brand, then compare nearby pharmacy options.</p></div>
      <div className="catalog-count"><b>{medications.length}</b><span>products</span></div>
    </div>
    <div className="catalog-tools">
      <label className="catalog-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, ingredients, or brands" aria-label="Search product list" /></label>
      <span className="catalog-result-count" aria-live="polite">{visible.length} shown</span>
    </div>
    <div className="catalog-categories" aria-label="Filter products by category">
      {categories.map((item) => <button key={item} type="button" className={`category-chip${category === item ? ' selected' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
    </div>
    {status ? <section className="catalog-empty" role="status"><p>{status}</p>{status !== 'Loading products…' && <button className="text-btn" type="button" onClick={() => setRequest((value) => value + 1)}>Try again</button>}</section> : visible.length ? <section className="product-grid" aria-label="Products">
      {visible.map((item) => {
        const aliases = (item.aka || '').split(' · ').filter(Boolean).slice(0, 3);
        return <article className="product-card" key={item.id}>
          <div className="product-card-top"><span className="product-category">{item.category || 'OTC'}</span>{item.store_count != null && <span className="product-store-count" title="Stores with confirmed in-stock or limited-stock availability">{item.store_count} {item.store_count === 1 ? 'store' : 'stores'}</span>}</div>
          <h2>{item.name}</h2>
          <p className="product-strength">{item.strength}{item.quantity_label ? ` · ${item.quantity_label}` : ''}</p>
          {!!aliases.length && <div className="product-aliases" aria-label="Also known as">{aliases.map((alias) => <span key={alias}>{alias}</span>)}</div>}
          <a className="product-compare" href={`/results.html?medication=${encodeURIComponent(item.id)}`}>Compare pharmacies <span aria-hidden="true">→</span></a>
        </article>;
      })}
    </section> : <section className="catalog-empty"><h2>No products found</h2><p>Try another name, ingredient, brand, or category.</p><button className="text-btn" type="button" onClick={() => { setQuery(''); setCategory('All products'); }}>Clear filters</button></section>}
  </main></AppShell>;
}
