type SkeletonVariant = 'rows' | 'cards' | 'metrics' | 'detail' | 'finance';

export function Skeletons({ variant = 'rows', count = 3 }: { variant?: SkeletonVariant; count?: number }) {
  const items = Array.from({ length: count }, (_, index) => index);
  return <div className={`skeletons skeletons-${variant}`} role="status">
    <span className="visually-hidden">Cargando contenido…</span>
    <div aria-hidden="true">
      {variant === 'rows' && items.map(index => <div className="skeleton-row" key={index}>
        <i className="skeleton-shape skeleton-avatar" />
        <span className="skeleton-copy"><i className="skeleton-shape skeleton-line wide" /><i className="skeleton-shape skeleton-line narrow" /></span>
        <i className="skeleton-shape skeleton-pill" />
      </div>)}
      {variant === 'cards' && items.map(index => <section className="card skeleton-card" key={index}>
        <div className="skeleton-heading"><i className="skeleton-shape skeleton-line title" /><i className="skeleton-shape skeleton-pill" /></div>
        <i className="skeleton-shape skeleton-line wide" />
        <i className="skeleton-shape skeleton-line medium" />
        <i className="skeleton-shape skeleton-line narrow" />
      </section>)}
      {variant === 'metrics' && <section className="card skeleton-card">
        <i className="skeleton-shape skeleton-line title" />
        <div className="skeleton-metrics">{items.slice(0, 4).map(index => <i className="skeleton-shape skeleton-metric" key={index} />)}</div>
        <i className="skeleton-shape skeleton-line wide" />
      </section>}
      {variant === 'detail' && <section className="card skeleton-card">
        <div className="skeleton-heading"><i className="skeleton-shape skeleton-line title" /><i className="skeleton-shape skeleton-pill" /></div>
        <i className="skeleton-shape skeleton-line medium" />
        <i className="skeleton-shape skeleton-line wide" />
        <i className="skeleton-shape skeleton-line narrow" />
        <i className="skeleton-shape skeleton-line title" />
        {items.slice(0, 2).map(index => <div className="skeleton-row" key={index}>
          <span className="skeleton-copy"><i className="skeleton-shape skeleton-line medium" /><i className="skeleton-shape skeleton-line narrow" /></span>
          <i className="skeleton-shape skeleton-line narrow" />
        </div>)}
      </section>}
      {variant === 'finance' && <>
        <section className="card skeleton-card">
          <i className="skeleton-shape skeleton-line title" />
          <div className="skeleton-metrics">{items.slice(0, 4).map(index => <i className="skeleton-shape skeleton-metric" key={index} />)}</div>
          <i className="skeleton-shape skeleton-line wide" />
        </section>
        <section className="card skeleton-card">
          <i className="skeleton-shape skeleton-line title" />
          {items.slice(0, 3).map(index => <div className="skeleton-row" key={index}>
            <span className="skeleton-copy"><i className="skeleton-shape skeleton-line medium" /><i className="skeleton-shape skeleton-line narrow" /></span>
            <i className="skeleton-shape skeleton-line narrow" />
          </div>)}
        </section>
      </>}
    </div>
  </div>;
}
