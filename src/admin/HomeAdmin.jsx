import React, { useContext } from "react";
import { StoreContext } from "../context/StoreContext";

const HomeAdmin = () => {
  const {
    homeHeroes,
    createHomeHero,
    updateHomeHero,
    deleteHomeHero,
  } = useContext(StoreContext);

  return (
    <div className="admin-page">
      <h1>Homepage Heroes</h1>

      <button onClick={createHomeHero} style={{ marginBottom: 20 }}>
        + Add Hero
      </button>

      {homeHeroes.length === 0 && (
        <p>No heroes yet. Add your first hero.</p>
      )}

      {homeHeroes.map((hero, index) => (
        <div
          key={hero.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 20,
          }}
        >
          <h3>Hero #{index + 1}</h3>

          <label>Title</label>
          <input
            value={hero.title || ""}
            onChange={(e) =>
              updateHomeHero(hero.id, { title: e.target.value })
            }
          />

          <label>Subtitle</label>
          <input
            value={hero.subtitle || ""}
            onChange={(e) =>
              updateHomeHero(hero.id, { subtitle: e.target.value })
            }
          />

          <label>Image URL</label>
          <input
            value={hero.image_url || ""}
            onChange={(e) =>
              updateHomeHero(hero.id, { image_url: e.target.value })
            }
          />

          <button
            onClick={() => deleteHomeHero(hero.id)}
            style={{ marginTop: 10, color: "red" }}
          >
            Delete Hero
          </button>
        </div>
      ))}
    </div>
  );
};

export default HomeAdmin;
