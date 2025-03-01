(function() {
  // Create a container for our overlay UI inside a Shadow DOM to isolate our styles.
  let extContainer = document.createElement('div');
  extContainer.id = "extension-container";
  document.body.appendChild(extContainer);
  let shadow = extContainer.attachShadow({ mode: 'open' });

  // Create overlay element for the UI.
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
  shadow.appendChild(overlay);

  // Inject Bootstrap into the shadow DOM so our UI styles remain intact.
  let bootstrapLink = document.createElement('link');
  bootstrapLink.rel = "stylesheet";
  bootstrapLink.href = "https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css";
  shadow.appendChild(bootstrapLink);

  // Create an instruction card using Bootstrap classes.
  let card = document.createElement('div');
  card.className = "card";
  card.style.position = "fixed";
  card.style.top = "10px";
  card.style.left = "50%";
  card.style.transform = "translateX(-50%)";
  card.style.zIndex = "1000000";
  card.style.width = "auto";
  card.style.padding = "10px";
  overlay.appendChild(card);

  let cardBody = document.createElement('div');
  cardBody.className = "card-body";
  cardBody.innerText = "Click on an image (or background image). Press Esc or click Cancel to abort.";
  card.appendChild(cardBody);

  // Cancel button styled with Bootstrap.
  let cancelButton = document.createElement('button');
  cancelButton.className = "btn btn-danger ml-2";
  cancelButton.innerText = "Cancel";
  cancelButton.onclick = cancelSelection;
  cardBody.appendChild(cancelButton);

  // Global variable for our dynamic highlight overlay.
  let highlightOverlay = null;

  // --- IMAGE DETECTION AND SPIDER FUNCTIONS ---

  // Returns the image element (if any) closest to the given point.
  function getClosestImageElement(x, y) {
    let elements = document.elementsFromPoint(x, y);
    let candidates = [];
    for (let el of elements) {
      let computed = window.getComputedStyle(el);
      if ((el.tagName && el.tagName.toLowerCase() === "img" && el.src) ||
          (computed.backgroundImage && computed.backgroundImage !== "none")) {
        candidates.push(el);
      }
    }
    if (candidates.length > 0) {
      let best = null;
      let bestDistance = Infinity;
      for (let el of candidates) {
        let rect = el.getBoundingClientRect();
        let cx = rect.left + rect.width / 2;
        let cy = rect.top + rect.height / 2;
        let dx = cx - x;
        let dy = cy - y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = el;
        }
      }
      return best;
    }
    return null;
  }

  // Checks if an element directly provides an image source.
  function checkElementForImage(el) {
    if (!el) return null;
    if (el.tagName && el.tagName.toLowerCase() === "img" && el.src) {
      return el.src;
    }
    let bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      let match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  // Recursively search descendants for an image.
  function searchDescendantsForImage(el) {
    if (!el) return null;
    let imgs = el.getElementsByTagName("img");
    if (imgs.length > 0) return imgs[0].src;
    for (let child of el.children) {
      let result = checkElementForImage(child);
      if (result) return result;
      result = searchDescendantsForImage(child);
      if (result) return result;
    }
    return null;
  }

  // Spider: crawl upward and examine siblings to find an image source.
  function findImageUrlFromElement(el) {
    let url = checkElementForImage(el);
    if (url) return url;
    let container = el;
    while (container) {
      // Check siblings at this level.
      if (container.parentElement) {
        let siblings = container.parentElement.children;
        for (let sibling of siblings) {
          if (sibling !== container) {
            url = checkElementForImage(sibling) || searchDescendantsForImage(sibling);
            if (url) return url;
          }
        }
      }
      // Move up one level.
      url = checkElementForImage(container.parentElement);
      if (url) return url;
      container = container.parentElement;
    }
    return null;
  }

  // --- HIGHLIGHT HANDLING VIA MOUSEMOVE ---

  // Update the highlight overlay based on the element at the current mouse position.
  function updateHighlight(e) {
    let candidate = getClosestImageElement(e.clientX, e.clientY);
    if (candidate) {
      let rect = candidate.getBoundingClientRect();
      if (!highlightOverlay) {
        highlightOverlay = document.createElement('div');
        highlightOverlay.style.position = 'fixed';
        highlightOverlay.style.border = '3px solid red';
        highlightOverlay.style.pointerEvents = 'none';
        highlightOverlay.style.zIndex = '10000000';
        document.body.appendChild(highlightOverlay);
      }
      highlightOverlay.style.top = rect.top + 'px';
      highlightOverlay.style.left = rect.left + 'px';
      highlightOverlay.style.width = rect.width + 'px';
      highlightOverlay.style.height = rect.height + 'px';
    } else if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
  }

  document.addEventListener('mousemove', updateHighlight, true);

  // --- EVENT HANDLERS ---

  // Remove the document-level event listeners.
  function removeDocListeners() {
    document.removeEventListener('mousemove', updateHighlight, true);
    document.removeEventListener('click', onClick, true);
  }

  // onClick: find the closest image element based on click coordinates.
  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    let candidate = getClosestImageElement(e.clientX, e.clientY);
    if (!candidate) {
      console.log("No image candidate found near click.");
      return;
    }
    let imageUrl = checkElementForImage(candidate) || findImageUrlFromElement(candidate);
    if (!imageUrl) {
      console.log("No image found for clicked element");
      return;
    }
    removeDocListeners();
    removeHighlight();
    // Enable overlay UI interaction.
    overlay.style.pointerEvents = "auto";
    showFormatSelection(imageUrl, candidate);
  }

  document.addEventListener('click', onClick, true);

  // Remove the highlight overlay from the document.
  function removeHighlight() {
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
  }

  // --- UI: Format Selection and Download ---

  function showFormatSelection(imageUrl, targetEl) {
    overlay.innerHTML = "";
    overlay.style.cursor = "default";

    let preview = document.createElement('img');
    preview.src = imageUrl;
    preview.className = "img-fluid mx-auto d-block";
    preview.style.maxWidth = "90%";
    preview.style.maxHeight = "60%";
    preview.style.margin = "20px auto";
    overlay.appendChild(preview);

    let container = document.createElement('div');
    container.className = "text-center";
    let infoText = document.createElement('p');
    infoText.innerText = "Choose a format to download:";
    container.appendChild(infoText);

    let formats = ["png", "jpeg", "svg"];
    formats.forEach(fmt => {
      let btn = document.createElement('button');
      btn.innerText = fmt.toUpperCase();
      btn.className = "btn btn-primary m-2";
      btn.addEventListener('click', () => {
        downloadImage(imageUrl, fmt, targetEl);
        overlay.remove();
      });
      container.appendChild(btn);
    });

    let cancelBtn = document.createElement('button');
    cancelBtn.innerText = "Cancel";
    cancelBtn.className = "btn btn-secondary m-2";
    cancelBtn.addEventListener('click', cancelSelection);
    container.appendChild(cancelBtn);

    overlay.appendChild(container);
  }

  // Download the image and remove its highlight once done.
  function downloadImage(url, format, targetEl) {
    if (format === "svg" && !url.endsWith(".svg")) {
      alert("SVG conversion is only supported for actual SVG images.");
      return;
    }
    if (format === "svg") {
      directDownload(url, "download.svg");
      removeHighlight();
      return;
    }
    fetch(url, { mode: 'cors' })
      .then(response => {
        if (!response.ok) throw new Error("Fetch failed");
        return response.blob();
      })
      .then(blob => {
        let img = new Image();
        img.crossOrigin = "Anonymous";
        let objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        img.onload = function() {
          let canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          let ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          let dataUrl = canvas.toDataURL("image/" + format);
          directDownload(dataUrl, "download." + format);
          URL.revokeObjectURL(objectUrl);
          removeHighlight();
        }
      })
      .catch(err => {
        console.warn("Failed to fetch image for conversion:", err);
        alert("Failed to fetch image. Downloading original file instead.");
        let ext = url.split('.').pop().split(/[?#]/)[0] || 'jpg';
        directDownload(url, "download." + ext);
        removeHighlight();
      });
  }

  // Create a temporary <a> element to trigger the download.
  function directDownload(href, filename) {
    let a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Allow cancelling via the Esc key.
  window.addEventListener('keydown', function escListener(e) {
    if (e.key === "Escape") {
      cancelSelection();
      window.removeEventListener('keydown', escListener);
    }
  });

  // Cancel the current selection: remove overlay and event listeners.
  function cancelSelection() {
    overlay.remove();
    removeDocListeners();
    removeHighlight();
  }
})();

