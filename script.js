
"use strict";

// TheMealDB public test API
const API_BASE = "https://www.themealdb.com/api/json/v1/1";

// HTML elements
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const recipeGrid = document.getElementById("recipeGrid");
const statusMessage = document.getElementById("statusMessage");
const sectionTitle = document.getElementById("sectionTitle");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const resultCount = document.getElementById("resultCount");
const favoriteCount = document.getElementById("favoriteCount");
const favoritesNav = document.getElementById("favoritesNav");
const showAllButton = document.getElementById("showAllButton");
const loadMoreButton = document.getElementById("loadMoreButton");
const recipeModal = document.getElementById("recipeModal");
const modalContent = document.getElementById("modalContent");
const closeModalButton = document.getElementById("closeModal");

// App state
const FAVORITES_KEY = "freshbite_favorites";
const PAGE_SIZE = 12;

let allRecipes = [];
let visibleLimit = PAGE_SIZE;
let favorites = readFavorites();
let currentView = "discover";
let currentSearch = "";
let currentSearchMode = "name";
let requestNumber = 0;
let previousFocus = null;
let currentDetailRequest = 0;

// Read favorites safely from LocalStorage
function readFavorites() {
  try {
    const data = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// API helper
async function apiRequest(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to connect to the recipe service.");
  }

  return response.json();
}

// Show status message
function showStatus(title, message, symbol = "✳") {
  statusMessage.classList.remove("hidden");
  statusMessage.replaceChildren();

  const icon = document.createElement("span");
  icon.className = "status-icon";
  icon.textContent = symbol;

  const heading = document.createElement("h3");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  statusMessage.append(icon, heading, paragraph);
}

// Loading state
function setLoading(loading) {
  searchButton.disabled = loading;
  searchButton.textContent = loading ? "Searching..." : "Find Recipes";
  searchButton.style.opacity = loading ? "0.7" : "1";
}

// Load available meal categories
async function loadCategories() {
  try {
    const data = await apiRequest("categories.php");
    const categories = data.categories || [];

    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.strCategory;
      option.textContent = category.strCategory;
      categoryFilter.appendChild(option);
    });
  } catch (error) {
    console.warn("Could not load categories:", error.message);
  }
}

// Get recipe IDs and names from API results
function normalizeRecipes(recipes) {
  return (recipes || []).filter(recipe => recipe.idMeal).map(recipe => ({
    idMeal: recipe.idMeal,
    strMeal: recipe.strMeal || "Untitled recipe",
    strMealThumb: recipe.strMealThumb || "",
    strCategory: recipe.strCategory || "",
    strArea: recipe.strArea || ""
  }));
}

// Search by recipe name or main ingredient
async function searchRecipes(query, mode = "name") {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const requestId = ++requestNumber;

  currentView = "discover";
  currentSearch = cleanQuery;
  currentSearchMode = mode;
  visibleLimit = PAGE_SIZE;
  categoryFilter.value = "";

  sectionTitle.textContent = `Results for "${cleanQuery}"`;
  sectionSubtitle.textContent = mode === "ingredient"
    ? "Recipes using your chosen ingredient."
    : "Recipes matching your search.";
  resultCount.textContent = "";
  recipeGrid.replaceChildren();
  loadMoreButton.classList.add("hidden");
  showAllButton.classList.remove("hidden");
  showStatus("Finding delicious recipes...", "Please wait a moment.", "⌕");
  setLoading(true);

  try {
    let data;

    if (mode === "ingredient") {
      data = await apiRequest("filter.php", { i: cleanQuery });
    } else {
      data = await apiRequest("search.php", { s: cleanQuery });
    }

    if (requestId !== requestNumber) return;

    allRecipes = normalizeRecipes(data.meals);
    renderRecipes();

  } catch (error) {
    if (requestId !== requestNumber) return;

    allRecipes = [];
    renderRecipes();
    showStatus(
      "Unable to load recipes",
      "Please check your internet connection and try again.",
      "!"
    );
  } finally {
    if (requestId === requestNumber) {
      setLoading(false);
    }
  }
}

// Browse recipes by category
async function browseCategory(category) {
  if (!category) {
    loadDefaultRecipes();
    return;
  }

  const requestId = ++requestNumber;

  currentView = "category";
  currentSearch = "";
  visibleLimit = PAGE_SIZE;

  sectionTitle.textContent = `${category} Recipes`;
  sectionSubtitle.textContent = `Explore delicious ${category.toLowerCase()} dishes.`;
  resultCount.textContent = "";
  recipeGrid.replaceChildren();
  loadMoreButton.classList.add("hidden");
  showStatus("Loading recipes...", "Finding recipes in this category.", "⌕");

  try {
    const data = await apiRequest("filter.php", { c: category });

    if (requestId !== requestNumber) return;

    allRecipes = normalizeRecipes(data.meals);
    renderRecipes();

  } catch (error) {
    if (requestId !== requestNumber) return;

    allRecipes = [];
    renderRecipes();
    showStatus("Could not load recipes", "Please try again later.", "!");
  }
}

// Load some recipes for the initial homepage
async function loadDefaultRecipes() {
  const requestId = ++requestNumber;

  currentView = "discover";
  currentSearch = "";
  currentSearchMode = "name";
  visibleLimit = PAGE_SIZE;
  categoryFilter.value = "";

  sectionTitle.textContent = "Explore recipes";
  sectionSubtitle.textContent = "A little inspiration for your next meal.";
  showAllButton.classList.add("hidden");
  resultCount.textContent = "";
  recipeGrid.replaceChildren();
  loadMoreButton.classList.add("hidden");
  showStatus("Preparing your recipe collection...", "Loading tasty ideas.", "✳");

  try {
    // The API returns matching recipes, not a full random catalogue.
    const data = await apiRequest("search.php", { s: "chicken" });

    if (requestId !== requestNumber) return;

    allRecipes = normalizeRecipes(data.meals);
    renderRecipes();

  } catch (error) {
    if (requestId !== requestNumber) return;

    allRecipes = [];
    renderRecipes();
    showStatus(
      "Connection problem",
      "Check your internet connection and refresh the page.",
      "!"
    );
  }
}

// Favorites helpers
function isFavorite(id) {
  return favorites.some(recipe => recipe.idMeal === id);
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    updateFavoriteCount();
    return true;
  } catch {
    showStatus(
      "Could not save favorites",
      "Browser storage may be full or unavailable.",
      "!"
    );
    return false;
  }
}

function toggleFavorite(recipe) {
  if (isFavorite(recipe.idMeal)) {
    favorites = favorites.filter(item => item.idMeal !== recipe.idMeal);
  } else {
    favorites = [...favorites, recipe];
  }

  saveFavorites();

  if (currentView === "favorites") {
    renderRecipes();
  }
}

function updateFavoriteCount() {
  favoriteCount.textContent = favorites.length;
}

// Create recipe card without inserting API text as HTML
function createRecipeCard(recipe) {
  const card = document.createElement("article");
  card.className = "recipe-card";
  card.tabIndex = 0;
  card.setAttribute("aria-label", `View recipe: ${recipe.strMeal}`);

  const imageWrap = document.createElement("div");
  imageWrap.className = "recipe-image-wrap";

  if (recipe.strMealThumb) {
    const image = document.createElement("img");
    image.className = "recipe-image";
    image.src = recipe.strMealThumb;
    image.alt = recipe.strMeal;
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.remove();

      const placeholder = document.createElement("div");
      placeholder.className = "recipe-image-placeholder";
      placeholder.textContent = "✳";
      imageWrap.prepend(placeholder);
    }, { once: true });

    imageWrap.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "recipe-image-placeholder";
    placeholder.textContent = "✳";
    imageWrap.appendChild(placeholder);
  }

  if (recipe.strCategory) {
    const badge = document.createElement("span");
    badge.className = "recipe-category-badge";
    badge.textContent = recipe.strCategory;
    imageWrap.appendChild(badge);
  }

  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "favorite-button";

  function updateHeart() {
    const saved = isFavorite(recipe.idMeal);
    favoriteButton.textContent = saved ? "♥" : "♡";
    favoriteButton.classList.toggle("active", saved);
    favoriteButton.setAttribute(
      "aria-label",
      saved ? "Remove favorite" : "Add favorite"
    );
  }

  updateHeart();

  favoriteButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleFavorite(recipe);
    updateHeart();
  });

  imageWrap.appendChild(favoriteButton);

  const info = document.createElement("div");
  info.className = "recipe-info";

  const area = document.createElement("div");
  area.className = "recipe-area";
  area.textContent = recipe.strArea || "Discover";

  const title = document.createElement("h3");
  title.className = "recipe-title";
  title.textContent = recipe.strMeal;

  const bottom = document.createElement("div");
  bottom.className = "recipe-bottom";

  const label = document.createElement("span");
  label.textContent = "View ingredients & method";

  const link = document.createElement("span");
  link.className = "view-recipe";
  link.textContent = "View recipe →";

  bottom.append(label, link);
  info.append(area, title, bottom);
  card.append(imageWrap, info);

  card.addEventListener("click", () => {
    openRecipeDetails(recipe.idMeal);
  });

  card.addEventListener("keydown", event => {
    if (
      event.target === card &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      openRecipeDetails(recipe.idMeal);
    }
  });

  return card;
}

// Render and filter recipes
function renderRecipes() {
  recipeGrid.replaceChildren();
  statusMessage.classList.add("hidden");

  let recipes = currentView === "favorites"
    ? [...favorites]
    : [...allRecipes];

  if (categoryFilter.value && currentView !== "favorites") {
    // Category results already come from the category API.
    // Search results can also be filtered when category metadata exists.
    if (currentView === "discover" && !currentSearch) {
      recipes = recipes.filter(
        recipe => recipe.strCategory === categoryFilter.value
      );
    }
  }

  if (sortFilter.value === "az") {
    recipes.sort((a, b) => a.strMeal.localeCompare(b.strMeal));
  } else if (sortFilter.value === "za") {
    recipes.sort((a, b) => b.strMeal.localeCompare(a.strMeal));
  }

  const total = recipes.length;
  const visibleRecipes = recipes.slice(0, visibleLimit);

  visibleRecipes.forEach(recipe => {
    recipeGrid.appendChild(createRecipeCard(recipe));
  });

  resultCount.textContent = `${total} recipe${total === 1 ? "" : "s"}`;

  if (total === 0) {
    showStatus(
      currentView === "favorites"
        ? "No favorite recipes yet"
        : "No recipes found",
      currentView === "favorites"
        ? "Tap the heart on a recipe to save it here."
        : "Try a different search term or choose another category.",
      "♡"
    );
  }

  loadMoreButton.classList.toggle("hidden", total <= visibleLimit);
  updateFavoriteCount();
}

// Load more locally available results
loadMoreButton.addEventListener("click", () => {
  visibleLimit += PAGE_SIZE;
  renderRecipes();
});

// Search form
searchForm.addEventListener("submit", event => {
  event.preventDefault();

  const mode = document.querySelector(
    'input[name="searchMode"]:checked'
  ).value;

  searchRecipes(searchInput.value, mode);
});

// Popular search buttons
document.querySelectorAll(".popular-searches button").forEach(button => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;

    const mode = document.querySelector(
      'input[name="searchMode"]:checked'
    ).value;

    searchRecipes(button.dataset.query, mode);
  });
});

// Category filter
categoryFilter.addEventListener("change", () => {
  const category = categoryFilter.value;

  if (!category) {
    loadDefaultRecipes();
  } else {
    browseCategory(category);
  }
});

// Sorting
sortFilter.addEventListener("change", renderRecipes);

// Show favorites
favoritesNav.addEventListener("click", () => {
  requestNumber++;
  setLoading(false);

  currentView = "favorites";
  visibleLimit = PAGE_SIZE;
  categoryFilter.value = "";

  sectionTitle.textContent = "My Favorite Recipes";
  sectionSubtitle.textContent = "Your personal collection of saved dishes.";
  showAllButton.classList.remove("hidden");
  renderRecipes();

  document.getElementById("discover").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// Return to discover view
showAllButton.addEventListener("click", () => {
  currentView = "discover";

  if (currentSearch) {
    searchRecipes(currentSearch, currentSearchMode);
  } else if (categoryFilter.value) {
    browseCategory(categoryFilter.value);
  } else {
    loadDefaultRecipes();
  }
});

// Extract ingredient/measure pairs from full recipe details
function getIngredients(recipe) {
  const ingredients = [];

  for (let i = 1; i <= 20; i++) {
    const ingredient = recipe[`strIngredient${i}`]?.trim();
    const measure = recipe[`strMeasure${i}`]?.trim();

    if (ingredient) {
      ingredients.push({
        name: ingredient,
        measure: measure && measure !== " " ? measure : ""
      });
    }
  }

  return ingredients;
}

// Add a text-only detail section
function addDetailSection(parent, headingText, text) {
  if (!text || text === "N/A") return;

  const heading = document.createElement("h3");
  heading.textContent = headingText;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  parent.append(heading, paragraph);
}

// Open recipe details
async function openRecipeDetails(id) {
  const detailRequest = ++currentDetailRequest;
  previousFocus = document.activeElement;

  recipeModal.classList.remove("hidden");
  modalContent.replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Loading recipe details...";
  modalContent.appendChild(loading);

  closeModalButton.focus();

  try {
    const data = await apiRequest("lookup.php", { i: id });
    const recipe = data.meals?.[0];

    if (detailRequest !== currentDetailRequest) return;
    if (!recipe) throw new Error("Recipe details are unavailable.");

    modalContent.replaceChildren();

    const layout = document.createElement("div");
    layout.className = "detail-layout";

    const image = document.createElement("img");
    image.className = "detail-image";
    image.alt = recipe.strMeal;
    image.src = recipe.strMealThumb || "";

    image.addEventListener("error", () => {
      image.removeAttribute("src");
      image.alt = "Recipe image unavailable";
      image.style.minHeight = "180px";
    }, { once: true });

    const content = document.createElement("div");
    content.className = "detail-content";

    const title = document.createElement("h2");
    title.id = "modalTitle";
    title.textContent = recipe.strMeal;

    const meta = document.createElement("div");
    meta.className = "detail-meta";

    [recipe.strCategory, recipe.strArea].filter(Boolean).forEach(value => {
      const badge = document.createElement("span");
      badge.textContent = value;
      meta.appendChild(badge);
    });

    content.append(title, meta);

    const ingredientHeading = document.createElement("h3");
    ingredientHeading.textContent = "Ingredients";

    const ingredientList = document.createElement("ul");
    ingredientList.className = "ingredients-list";

    getIngredients(recipe).forEach(item => {
      const li = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", `Mark ${item.name} as ready`);

      const text = document.createElement("span");
      text.textContent = [item.measure, item.name]
        .filter(Boolean)
        .join(" ");

      li.append(checkbox, text);
      ingredientList.appendChild(li);
    });

    content.append(ingredientHeading, ingredientList);

    const instructionsHeading = document.createElement("h3");
    instructionsHeading.textContent = "Cooking Instructions";

    const instructions = document.createElement("p");
    instructions.className = "instructions";
    instructions.textContent = recipe.strInstructions ||
      "Instructions are not available for this recipe.";

    content.append(instructionsHeading, instructions);

    const actions = document.createElement("div");
    actions.className = "detail-actions";

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "detail-favorite";

    function updateDetailFavorite() {
      favoriteButton.textContent = isFavorite(recipe.idMeal)
        ? "♥ Remove Favorite"
        : "♡ Save Favorite";
    }

    updateDetailFavorite();

    favoriteButton.addEventListener("click", () => {
      toggleFavorite(recipe);
      updateDetailFavorite();
    });

    actions.appendChild(favoriteButton);

    if (recipe.strYoutube) {
      const videoLink = document.createElement("a");
      videoLink.className = "video-link";
      videoLink.href = recipe.strYoutube;
      videoLink.target = "_blank";
      videoLink.rel = "noopener noreferrer";
      videoLink.textContent = "▶ Watch video";
      actions.appendChild(videoLink);
    }

    if (recipe.strSource) {
      const sourceLink = document.createElement("a");
      sourceLink.className = "video-link";
      sourceLink.href = recipe.strSource;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "Original recipe ↗";
      actions.appendChild(sourceLink);
    }

    content.appendChild(actions);
    layout.append(image, content);
    modalContent.appendChild(layout);

  } catch (error) {
    if (detailRequest !== currentDetailRequest) return;

    modalContent.replaceChildren();

    const message = document.createElement("p");
    message.textContent = error.message || "Unable to load recipe details.";
    modalContent.appendChild(message);
  }
}

// Close modal
function closeRecipeModal() {
  recipeModal.classList.add("hidden");
  currentDetailRequest++;

  if (previousFocus && document.contains(previousFocus)) {
    previousFocus.focus();
  }
}

closeModalButton.addEventListener("click", closeRecipeModal);

recipeModal.addEventListener("click", event => {
  if (event.target.hasAttribute("data-close-modal")) {
    closeRecipeModal();
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !recipeModal.classList.contains("hidden")
  ) {
    closeRecipeModal();
  }
});

// Start the app
updateFavoriteCount();
loadCategories();
loadDefaultRecipes();
