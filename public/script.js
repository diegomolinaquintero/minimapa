fetch('/data/linderos')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data).addTo(map);
  })
  .catch(error => console.error('Error al cargar el GeoJSON:', error));

  if (capa == "linderos") {
    // Lógica para asegurarse de que "linderos" esté activada desde el inicio
}

