chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("persistent.html"),
    type: "popup",
    width: 400,
    height: 600
  });
});

