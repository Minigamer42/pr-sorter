import { useEffect } from "react";
import { sorters } from "./sorters.generated";

export function SorterIndex() {
  useEffect(() => {
    document.title = "PR Sorters";
    document.body.classList.add("sorter-index-body");
    document.querySelector('meta[name="og:site_name"]')?.setAttribute("content", "PR Sorters");
    document.querySelector('meta[name="og:description"]')?.setAttribute("content", "Choose a sorter to start ranking.");

    return () => {
      document.body.classList.remove("sorter-index-body");
    };
  }, []);

  return (
    <div className="main-page main-page--landing sorter-index-page">
      <div className="title">
        Choose a sorter to start ranking.
      </div>
      {sorters.length ? (
        <div className="sorter-index-grid">
          {sorters.map((sorter) => (
            <a className="sorter-index-card" href={`${sorter.slug}/`} key={sorter.slug}>
              <img className="sorter-index-card__icon" src={`${sorter.slug}/customize/favicon.ico`} alt="" />
              <div className="sorter-index-card__body">
                <h2>{sorter.title}</h2>
                <p>{sorter.description}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="sorter-index-empty">No sorters have been published yet.</p>
      )}
    </div>
  );
}
