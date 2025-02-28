(function() {
  // Create a semi‐transparent overlay that doesn't block underlying elements
  let overlay = document.createElement('div');
  overlay.id = "image-selector-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.3)";
  overlay.style.zIndex = "999999"; 
  overlay.style.cursor = "crosshair";
  overlay.style.pointerEvents = "none"; 
  document.body.appendChild(overlay);

  // Instructions box (clickable)
  let instructions = document.createElement('div');
  instructions.innerText = "Click on an image (or background image). Press Esc or click Cancel to abort.";
  instructions.style.position = "fixed";
  instructions.style.top = "10px";
  instructions.style.left = "50%";
  instructions.style.transform = "translateX(-50%)";
  instructions.style.backgroundColor = "#fff";
  instructions.style.padding = "10px";
  instructions.style.borderRadius = "4px";
  instructions.style.zIndex = "1000000";
  instructions.style.pointerEvents = "auto"; 
  overlay.appendChild(instructions);

  // Cancel button (clickable)
  let cancelButton = document.createElement('button');
  cancelButton.innerText = "Cancel";
  cancelButton.style.marginLeft = "20px";
  cancelButton.onclick = cancelSelection;
  instructions.appendChild(cancelButton);

  // Press Esc to cancel
  window.addEventListener('keydown', function escListener(e) {
    if (e.key === "Escape") {
      cancelSelection();
      window.removeEventListener('keydown', escListener);
    }
  });

  function cancelSelection(){
    overlay.remove();
    removeDocListeners();
  }

  // Highlight <img> tags on hover
  let highlightClass = "image-selector-highlight";
  let style = document.createElement('style');
  style.innerText = `
    .${highlightClass} {
      outline: 3px solid red !important;
    }
  `;
  document.head.appendChild(style);

  function onMouseOver(e) {
    if(e.target.tagName && e.target.tagName.toLowerCase() === "img"){
      e.target.classList.add(highlightClass);
    }
  }
  function onMouseOut(e) {
    if(e.target.tagName && e.target.tagName.toLowerCase() === "img"){
      e.target.classList.remove(highlightClass);
    }
  }

  // Main click handler
  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    // Because overlay has pointerEvents=none, we use elementFromPoint to find the real target
    let el = document.elementFromPoint(e.clientX, e.clientY);
    let imageUrl = findImageUrl(el);
    if(!imageUrl) {
      console.log("No image found for clicked element");
      return;
    }
    removeDocListeners();
    // Switch overlay to "active" so it can capture clicks for the UI
    overlay.style.pointerEvents = "auto";
    showFormatSelection(imageUrl);
  }

  // Attempt to find an <img> or a background image
  function findImageUrl(el) {
    if(!el) return null;
    // If it's an <img> tag
    if(el.tagName && el.tagName.toLowerCase() === "img"){
      return el.src;
    }
    // Check if there's a background image
    let bg = window.getComputedStyle(el).backgroundImage;
    if(bg && bg !== "none"){
      // Usually in the form url("https://something.com/image.jpg")
      let match = bg.match(/url\(["']?(.*?)["']?\)/);
      if(match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function removeDocListeners(){
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);

  // Show a small UI with format options
  function showFormatSelection(imageUrl){
    overlay.innerHTML = ""; 
    overlay.style.cursor = "default";

    let preview = document.createElement('img');
    preview.src = imageUrl;
    preview.style.maxWidth = "90%";
    preview.style.maxHeight = "60%";
    preview.style.display = "block";
    preview.style.margin = "20px auto";
    overlay.appendChild(preview);

    let formatsDiv = document.createElement('div');
    formatsDiv.style.textAlign = "center";
    let infoText = document.createElement('p');
    infoText.innerText = "Choose a format to download:";
    formatsDiv.appendChild(infoText);

    let formats = ["png", "jpeg", "svg"];
    formats.forEach(fmt => {
      let btn = document.createElement('button');
      btn.innerText = fmt.toUpperCase();
      btn.style.margin = "10px";
      btn.addEventListener('click', () => {
        downloadImage(imageUrl, fmt);
        overlay.remove();
      });
      formatsDiv.appendChild(btn);
    });

    let cancelBtn = document.createElement('button');
    cancelBtn.innerText = "Cancel";
    cancelBtn.style.margin = "10px";
    cancelBtn.addEventListener('click', cancelSelection);
    formatsDiv.appendChild(cancelBtn);

    overlay.appendChild(formatsDiv);
  }

  // Download the image in the chosen format
  function downloadImage(url, format){
    // If user asked for SVG but the resource isn't actually an .svg
    if(format === "svg" && !url.endsWith(".svg")){
      alert("SVG conversion is only supported for actual SVG images.");
      return;
    }

    // If the user wants the raw .svg file
    if(format === "svg"){
      directDownload(url, "download.svg");
      return;
    }

    // Otherwise, attempt to fetch for conversion to PNG/JPEG
    fetch(url, { mode: 'cors' })
      .then(response => {
        if(!response.ok) throw new Error("Fetch failed");
        return response.blob();
      })
      .then(blob => {
        let img = new Image();
        img.crossOrigin = "Anonymous";
        let objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        img.onload = function(){
          let canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          let ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          let dataUrl = canvas.toDataURL("image/" + format);
          directDownload(dataUrl, "download." + format);
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(err => {
        // If fetch fails (CORS blocked, etc.), fallback to direct download (no conversion)
        console.warn("Failed to fetch image for conversion:", err);
        alert("Failed to fetch image. Downloading original file instead.");
        let ext = url.split('.').pop().split(/[?#]/)[0] || 'jpg';
        directDownload(url, "download." + ext);
      });
  }

  // Creates an <a> element to trigger a direct download
  function directDownload(href, filename){
    let a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
})();

