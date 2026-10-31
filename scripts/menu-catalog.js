export const CART_STORAGE_KEY = "brick-bun-cart";

const localFoodImage = (fileName) => `/assets/food/${fileName}`;

export const products = [
  {
    id: 1,
    name: "Original Brick Smash",
    price: 11.5,
    featured: true,
    description:
      "A 90g smash patty cooked on the brick oven, topped with American cheese, house-made pickles, and smoked onion sauce on a butter-toasted brioche bun.",
    image: localFoodImage("original_brick_smash.jpg"),
  },
  {
    id: 2,
    name: "Double Oak Smash",
    price: 15,
    featured: true,
    description:
      "Two 90g smash patties with double cheddar, crispy smoked bacon, and house-made BBQ glaze.",
    image: localFoodImage("oak_double_smash.jpg"),
  },
  {
    id: 3,
    name: "Triple-Cooked Fries",
    price: 5,
    featured: true,
    description:
      "Potatoes cut daily, triple-fried in beef tallow, and seasoned with smoked sea salt.",
    image: localFoodImage("triple_cooked_fries.jpg"),
  },
  {
    id: 4,
    name: "Austin Craft Lime Soda",
    price: 3.5,
    featured: true,
    description:
      "House-made lime soda with sparkling water and cane sugar.",
    image: localFoodImage("austin_craft_lime_soda.jpg"),
  },
  {
    id: 5,
    name: "Smokehouse Jalapeño Smash",
    price: 13.5,
    featured: true,
    description:
      "A 90g smash patty with pepper jack, jalapeños, toasted onions, and house-made creamy sauce on brioche.",
    image: localFoodImage("smokehouse_jalapeno_smash.jpg"),
  },
  {
    id: 6,
    name: "Texas Onion Smash",
    price: 13,
    featured: true,
    description:
      "A 90g smash patty topped with grilled onions, American cheddar, and lightly smoked barbecue sauce.",
    image: localFoodImage("texas_onion_smash.jpg"),
  },
  {
    id: 7,
    name: "Crispy Chicken Sandwich",
    price: 12.5,
    description:
      "Crispy chicken with fresh lettuce, pickles, and ranch on toasted bread.",
    image: localFoodImage("crispy_chicken_sandwich.jpg"),
  },
  {
    id: 8,
    name: "Hill Country Grilled Melt",
    price: 10.5,
    description:
      "A grilled sandwich with melted cheese and butter-toasted bread.",
    image: localFoodImage("hill_country_grilled_melt.jpg"),
  },
  {
    id: 9,
    name: "Smoky BBQ Wings",
    price: 10,
    description:
      "Oven-roasted chicken wings tossed in house-made barbecue sauce.",
    image: localFoodImage("smoky_bbq_wings.jpg"),
  },
  {
    id: 10,
    name: "Smokehouse BBQ Ribs",
    price: 16,
    description:
      "Slow-smoked ribs finished with house-made barbecue sauce.",
    image: localFoodImage("smokehouse_bbq_ribs.jpg"),
  },
  {
    id: 11,
    name: "Vanilla Cookie Shake",
    price: 6.5,
    description:
      "A creamy vanilla shake with chocolate cookie pieces.",
    image: localFoodImage("vanilla_cookie_shake.jpg"),
  },
  {
    id: 12,
    name: "Texas Chocolate Brownie",
    price: 5.5,
    description:
      "A rich chocolate brownie with a soft center and cocoa topping.",
    image: localFoodImage("texas_chocolate_brownie.jpg"),
  },
  {
    id: 13,
    name: "Caramel Ice Cream Sundae",
    price: 5,
    description:
      "Creamy vanilla ice cream finished with caramel sauce.",
    image: localFoodImage("caramel_ice_cream_sundae.jpg"),
  },
  {
    id: 14,
    name: "Hill Country Chop Salad",
    price: 8.5,
    description:
      "Crisp lettuce, tomato, cucumber, and ranch dressing served on the side.",
    image: localFoodImage("hill_country_chop_salad.jpg"),
  },
];

export function loadCart() {
  const storedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}");
  return new Map(
    Object.entries(storedCart)
      .map(([id, quantity]) => [Number(id), Number(quantity)])
      .filter(
        ([id, quantity]) =>
          products.some((product) => product.id === id) &&
          Number.isInteger(quantity) &&
          quantity > 0 &&
          quantity <= 25,
      ),
  );
}

export function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(Object.fromEntries(cart)));
}
