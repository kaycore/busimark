const WINDOWHEIGHT = 500;
const container = document.querySelector(".container");
let parentFolderID = null;
let selectionList = [];

// Storage functions
async function getLastFolder() {
  const result = await browser.storage.local.get("lastFolder");
  return result.lastFolder;
}

async function setLastFolder(folderId) {
  await browser.storage.local.set({ lastFolder: folderId });
}

function updateList(bookmarks, prev, moved = false) {
  if (!moved) {
    container.innerHTML = ""; // remove all children
    if (bookmarks[0]) {
      parentFolderID = bookmarks[0].parentId;
    }
  }

  for (bookmark of bookmarks) {
    const bookmarkElem = document.createElement("div");

    if (bookmark.title === "") {
      bookmarkElem.textContent = bookmark.url;
    } else {
      bookmarkElem.textContent = bookmark.title;
    }

    bookmarkElem.setAttribute("url", bookmark.url);
    bookmarkElem.setAttribute("type", bookmark.type);
    bookmarkElem.setAttribute("bkID", bookmark.id);
    bookmarkElem.setAttribute("parentID", bookmark.parentId);

    if (bookmark.type === "folder") {
      bookmarkElem.classList.add("folder-icon");
    } else {
      bookmarkElem.classList.add("bookmark-icon");
    }

    container.appendChild(bookmarkElem);
  }

  if (prev) {
    // scroll to the folder that we came from
    const ogFolder = document.querySelectorAll(`[bkID="${prev}"]`)[0];
    ogFolder.scrollIntoView();
    ogFolder.classList.add("inverted-colors");
  } else if (container.firstElementChild) {
    // folder might be empty
    container.firstElementChild.classList.add("inverted-colors");
    container.firstElementChild.scrollIntoView();
  }
}

function goDown(highlightedElem) {
  if (highlightedElem.nextElementSibling) {
    highlightedElem.classList.remove("inverted-colors");
    highlightedElem = highlightedElem.nextElementSibling;
    highlightedElem.classList.add("inverted-colors");

    let highlightedElemBotCor = highlightedElem.getBoundingClientRect().bottom;
    if (highlightedElemBotCor > WINDOWHEIGHT) {
      highlightedElem.scrollIntoView(false);
    }
  }
}

function goUp(highlightedElem) {
  if (highlightedElem.previousElementSibling) {
    highlightedElem.classList.remove("inverted-colors");
    highlightedElem = highlightedElem.previousElementSibling;
    highlightedElem.classList.add("inverted-colors");

    let highlightedElemTopCor = highlightedElem.getBoundingClientRect().top;
    if (highlightedElemTopCor < 0) {
      highlightedElem.scrollIntoView(true);
    }
  }
}

function open(e, highlightedElem) {
  if (highlightedElem.getAttribute("type") === "bookmark") {
    if (e.ctrlKey) {
      browser.tabs.create({ url: `${highlightedElem.getAttribute("url")}` });
    } else {
      browser.tabs.update({ url: `${highlightedElem.getAttribute("url")}` });
    }
    window.close();
  } else if (highlightedElem.getAttribute("type") === "folder") {
    parentFolderID = highlightedElem.getAttribute("bkID");
    setLastFolder(parentFolderID); // Store the folder we're opening
    browser.bookmarks
      .getChildren(parentFolderID)
      .then((bookmarks) => updateList(bookmarks, false));
  }
}

function backward(highlightedElem) {
  browser.bookmarks.get(parentFolderID).then((bookmarks) => {
    const grandparentID = bookmarks[0].parentId;
    if (grandparentID) {
      setLastFolder(grandparentID); // Store the folder we're going back to
      browser.bookmarks
        .getChildren(grandparentID)
        .then((bookmarks) => updateList(bookmarks, parentFolderID));
    }
  });
}

function goTop(highlightedElem) {
  highlightedElem.classList.remove("inverted-colors");
  highlightedElem = container.firstElementChild;
  highlightedElem.classList.add("inverted-colors");
  highlightedElem.scrollIntoView();
}

function goBottom(highlightedElem) {
  highlightedElem.classList.remove("inverted-colors");
  highlightedElem = container.lastElementChild;
  highlightedElem.classList.add("inverted-colors");
  highlightedElem.scrollIntoView();
}

function deleteBookmark(highlightedElem) {
  document.removeEventListener("keydown", handleKeyDown);

  const sure = document.createElement("div");
  const surelabel = document.createElement("label");
  surelabel.textContent =
    "Are you sure you want to delete these bookmarks/folders? y/n";
  sure.appendChild(surelabel);
  const surebtn = document.createElement("button");
  sure.appendChild(surebtn);
  sure.classList.add("sure");
  document.body.appendChild(sure);

  surebtn.focus();
  surebtn.addEventListener("keydown", (e) => {
    if (e.key === "y") {
      var nearbySibling = false;
      if (highlightedElem.previousElementSibling) {
        nearbySibling = highlightedElem.previousElementSibling;
      } else if (highlightedElem.nextElementSibling) {
        nearbySibling = highlightedElem.nextElementSibling;
      }

      if (highlightedElem.getAttribute("type") === "bookmark") {
        browser.bookmarks.remove(highlightedElem.getAttribute("bkID"));
      } else if (highlightedElem.getAttribute("type") === "folder") {
        browser.bookmarks.removeTree(highlightedElem.getAttribute("bkID"));
      }

      highlightedElem.remove();
      if (nearbySibling) {
        highlightedElem = nearbySibling;
        highlightedElem.classList.add("inverted-colors");
      }

      e.stopPropagation();
      sure.remove();
      document.addEventListener("keydown", handleKeyDown);
    } else if (e.key === "n") {
      e.stopPropagation();
      sure.remove();
      document.addEventListener("keydown", handleKeyDown);
    }
  });
}

function newFolder(e, highlightedElem) {
  e.preventDefault(); // prevent "n" from being input into text field
  document.removeEventListener("keydown", handleKeyDown);

  const inputContainer = document.createElement("div");
  inputContainer.classList.add("folder-name");

  const input = document.createElement("input");
  input.setAttribute("type", "text");

  inputContainer.appendChild(input);
  document.body.appendChild(inputContainer);
  input.focus();

  inputContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const newFolder = document.createElement("div");
      browser.bookmarks
        .create({ title: `${input.value}`, parentId: `${parentFolderID}` })
        .then((bk) => {
          newFolder.textContent = bk.title;
          newFolder.setAttribute("url", bk.url);
          newFolder.setAttribute("type", bk.type);
          newFolder.setAttribute("bkID", bk.id);
          newFolder.setAttribute("parentID", bk.parentId);
        });
      if (!highlightedElem) {
        newFolder.classList.add("inverted-colors"); // if newfolder is the only element left in container
      }
      newFolder.classList.add("folder");
      newFolder.classList.add("folder-icon");
      container.appendChild(newFolder);
      inputContainer.remove();
      document.addEventListener("keydown", handleKeyDown);
    }
  });
}

function search(e) {
  e.preventDefault();
  document.removeEventListener("keydown", handleKeyDown);

  const searchContainer = document.createElement("div");
  searchContainer.classList.add("search-cont");

  const searchBox = document.createElement("input");
  searchBox.classList.add("search");
  searchContainer.appendChild(searchBox);

  document.body.appendChild(searchContainer);
  document.body.insertBefore(searchContainer, container);
  searchBox.focus();

  searchBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      browser.bookmarks.search(searchBox.value).then((bookmarks) => {
        updateList(bookmarks, false);
        searchContainer.remove();
        document.addEventListener("keydown", handleKeyDown);
      });
    }
  });
}

function select(bkID) {
  const index = selectionList.indexOf(bkID);
  if (selectionList.includes(bkID, 0)) {
    selectionList.splice(index, 1);
  } else {
    selectionList.push(bkID);
  }
}

function moveTo() {
  selectionList.forEach((bkID) => {
    browser.bookmarks.move(bkID, { parentId: `${parentFolderID}` });
  });
  browser.bookmarks
    .get(selectionList)
    .then((bookmarks) => updateList(bookmarks, false, true));
  selectionList = [];
}

function edit(e, highlightedElem) {
  e.preventDefault();
  document.removeEventListener("keydown", handleKeyDown);

  const cont = document.createElement("div");
  cont.classList.add("edit");

  const title = document.createElement("input");
  const url = document.createElement("input");

  if (highlightedElem.getAttribute("type") === "bookmark") {
    title.value = highlightedElem.textContent;
    url.value = highlightedElem.getAttribute("url");
    cont.appendChild(title);
    cont.appendChild(url);
  } else {
    title.value = highlightedElem.textContent;
    cont.appendChild(title);
  }

  document.body.appendChild(cont);
  title.focus();

  cont.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      highlightedElem.textContent = title.value;
      browser.bookmarks.update(highlightedElem.getAttribute("bkID"), {
        title: title.value,
      });
      if (highlightedElem.getAttribute("bookmark")) {
        highlightedElem.setAttribute("url", url.value);
        browser.bookmarks.update(highlightedElem.getAttribute("bkID"), {
          url: url.value,
        });
      }
      cont.remove();
      document.addEventListener("keydown", handleKeyDown);
    }
  });
}

function handleKeyDown(e) {
  let highlightedElem = document.querySelector(".inverted-colors");

  switch (e.key) {
    case "j":
      goDown(highlightedElem);
      break;

    case "k":
      goUp(highlightedElem);
      break;

    case "l":
      open(e, highlightedElem);
      break;

    case "h":
      backward(highlightedElem);
      break;

    case "g":
      goTop(highlightedElem);
      break;

    case "G":
      goBottom(highlightedElem);
      break;

    case "d":
      deleteBookmark(highlightedElem);
      break;

    case "n":
      newFolder(e, highlightedElem);
      break;

    case "/":
      search(e);
      break;

    case " ":
      e.preventDefault(); // don't scroll
      highlightedElem.classList.toggle("selected");
      select(highlightedElem.getAttribute("bkID"));
      break;

    case "m":
      moveTo();
      break;

    case "e":
      edit(e, highlightedElem);
      break;

    default:
      break;
  }
}

// initial loading of bookmarks
async function initialize() {
  const bookmarks = await browser.bookmarks.getTree();
  const rootFolder = bookmarks[0];

  // Try to load last folder
  const lastFolderId = await getLastFolder();

  if (lastFolderId) {
    try {
      const lastFolder = await browser.bookmarks.get(lastFolderId);
      if (lastFolder.length > 0) {
        parentFolderID = lastFolderId;
        const children = await browser.bookmarks.getChildren(parentFolderID);
        updateList(children, false);
        return;
      }
    } catch (e) {
      console.log("Last folder not found, using default");
    }
  }

  // Fallback to default (toolbar folder)
  parentFolderID = rootFolder.id;
  const toolbarFolder = rootFolder.children[1];
  updateList(toolbarFolder.children, false);
}

initialize();

document.addEventListener("keydown", handleKeyDown);
