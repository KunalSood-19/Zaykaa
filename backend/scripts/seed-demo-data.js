/**
 * Zaykaa CE-1 Demo Mock Data Seeder
 * Populates realistic sample data for Restaurant and Delivery modules
 * adhering strictly to canonical JSON storage schemas, integer paise values,
 * and order lifecycle contracts.
 *
 * Usage:
 *   node backend/scripts/seed-demo-data.js
 *   or: npm run seed (from backend directory)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// Verified bcrypt hash for password "Password123!"
const DEMO_PASSWORD_HASH = '$2b$10$jVq0TFiiiXaqJ93YUV.rsuwKin8vJazFtCS2JnrhmBAKTXLIg/HN.';

// Timestamps relative to demo execution time
const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

// ==========================================
// 1. USERS COLLECTION (users.json)
// ==========================================
export const users = [
  // Restaurant Owner
  {
    id: 'usr_rest_owner_01',
    name: 'Chef Rajinder Sharma',
    email: 'chef.sharma@zaykaa.com',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98450 12345',
    role: 'restaurant',
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  // Delivery Partner 1 (Active courier with assigned order)
  {
    id: 'usr_courier_01',
    name: 'Vikram Malhotra',
    email: 'rider.vikram@zaykaa.com',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 22001',
    role: 'delivery',
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(48)
  },
  // Delivery Partner 2 (Available/Idle courier ready to claim orders)
  {
    id: 'usr_courier_02',
    name: 'Ramesh Patel',
    email: 'rider.ramesh@zaykaa.com',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 22002',
    role: 'delivery',
    createdAt: hoursAgo(36),
    updatedAt: hoursAgo(36)
  },
  // University Student Customers (associated with orders)
  {
    id: 'usr_cust_01',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33001',
    role: 'customer',
    createdAt: hoursAgo(60),
    updatedAt: hoursAgo(60)
  },
  {
    id: 'usr_cust_02',
    name: 'Priya Nair',
    email: 'priya.nair@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33002',
    role: 'customer',
    createdAt: hoursAgo(55),
    updatedAt: hoursAgo(55)
  },
  {
    id: 'usr_cust_03',
    name: 'Rohan Verma',
    email: 'rohan.verma@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33003',
    role: 'customer',
    createdAt: hoursAgo(50),
    updatedAt: hoursAgo(50)
  },
  {
    id: 'usr_cust_04',
    name: 'Ananya Sen',
    email: 'ananya.sen@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33004',
    role: 'customer',
    createdAt: hoursAgo(45),
    updatedAt: hoursAgo(45)
  },
  {
    id: 'usr_cust_05',
    name: 'Kunal Sood',
    email: 'kunal.sood@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33005',
    role: 'customer',
    createdAt: hoursAgo(40),
    updatedAt: hoursAgo(40)
  },
  {
    id: 'usr_cust_06',
    name: 'Neha Kapoor',
    email: 'neha.kapoor@university.edu',
    passwordHash: DEMO_PASSWORD_HASH,
    phone: '+91 98765 33006',
    role: 'customer',
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(30)
  }
];

// ==========================================
// 2. RESTAURANTS COLLECTION (restaurants.json)
// ==========================================
export const restaurants = [
  {
    id: 'rst_campus_zaika_01',
    ownerId: 'usr_rest_owner_01',
    name: 'Campus Zaika Central',
    description: 'Popular student dhaba & quick-service kitchen serving homestyle North Indian curries, rolls, thalis, Chinese bowls, and fresh beverages near South Campus.',
    cuisineTypes: ['North Indian', 'Chinese', 'Snacks', 'Beverages', 'South Indian'],
    address: {
      street: 'Shop 14, University Student Union Complex, South Campus Road',
      city: 'Bengaluru',
      pincode: '560029'
    },
    phone: '+91 98450 12345',
    imageUrl: '/assets/images/restaurants/campus-zaika.jpg',
    isOpen: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  }
];

// ==========================================
// 3. MENUS COLLECTION (menus.json)
// 15 items across 5 distinct categories with integer paise
// ==========================================
export const menus = [
  // North Indian
  {
    id: 'item_demo_01',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Butter Chicken with Naan',
    description: 'Tender chicken chunks simmered in aromatic makhani gravy served with crisp garlic butter naan.',
    category: 'North Indian',
    price: 26000, // ₹260.00
    imageUrl: '/assets/images/menu/butter-chicken.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_02',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Paneer Tikka Masala',
    description: 'Grilled cottage cheese cubes cooked in rich spiced onion-tomato gravy with bell peppers.',
    category: 'North Indian',
    price: 22000, // ₹220.00
    imageUrl: '/assets/images/menu/paneer-tikka-masala.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_03',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Dal Makhani Student Special',
    description: 'Slow-cooked black lentils with white butter and fresh cream, served with jeera rice.',
    category: 'North Indian',
    price: 16000, // ₹160.00
    imageUrl: '/assets/images/menu/dal-makhani.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_04',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Amritsari Kulcha with Chole',
    description: 'Crispy layered potato-paneer stuffed kulcha served with tangy pindi chole and pickled onions.',
    category: 'North Indian',
    price: 14000, // ₹140.00
    imageUrl: '/assets/images/menu/amritsari-kulcha.jpg',
    isAvailable: false, // Highlights out-of-stock badge in menu view
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  // Chinese
  {
    id: 'item_demo_05',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Schezwan Chicken Fried Rice',
    description: 'Wok-tossed long-grain basmati rice with fiery Schezwan peppers, egg, and tender chicken cubes.',
    category: 'Chinese',
    price: 19000, // ₹190.00
    imageUrl: '/assets/images/menu/schezwan-rice.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_06',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Veg Hakka Noodles',
    description: 'Classic stir-fried eggless noodles with crunchy julienned cabbage, carrots, capsicum, and light soy.',
    category: 'Chinese',
    price: 15000, // ₹150.00
    imageUrl: '/assets/images/menu/hakka-noodles.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_07',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Chilli Paneer Dry',
    description: 'Crisp battered paneer cubes tossed with spring onions, capsicum, and spicy Indo-Chinese dark sauce.',
    category: 'Chinese',
    price: 18000, // ₹180.00
    imageUrl: '/assets/images/menu/chilli-paneer.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_08',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Chicken Steamed Momos (6 pcs)',
    description: 'Delicate Himalayan style dumplings stuffed with minced seasoned chicken, served with fiery garlic dip.',
    category: 'Chinese',
    price: 13000, // ₹130.00
    imageUrl: '/assets/images/menu/chicken-momos.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  // Snacks
  {
    id: 'item_demo_09',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Paneer Kathi Roll',
    description: 'Flaky layered paratha wrapped with marinated tandoori paneer, mint coriander chutney, and onions.',
    category: 'Snacks',
    price: 11000, // ₹110.00
    imageUrl: '/assets/images/menu/paneer-roll.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_10',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Egg Chicken Double Roll',
    description: 'Double egg coated paratha packed with spiced shredded chicken breast and crunchy shredded salad.',
    category: 'Snacks',
    price: 14000, // ₹140.00
    imageUrl: '/assets/images/menu/chicken-roll.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_11',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Crispy Samosa Chaat',
    description: 'Crushed golden potato samosas layered with warm spiced chole, sweet curd, tamarind, and sev.',
    category: 'Snacks',
    price: 7000, // ₹70.00
    imageUrl: '/assets/images/menu/samosa-chaat.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  // Beverages
  {
    id: 'item_demo_12',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Kulhad Masala Chai',
    description: 'Freshly brewed strong Assam tea with crushed ginger, green cardamom, and spices in baked clay cup.',
    category: 'Beverages',
    price: 3500, // ₹35.00
    imageUrl: '/assets/images/menu/kulhad-chai.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_13',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Sweet Punjabi Lassi',
    description: 'Thick hand-churned yogurt drink infused with rose water, topped with rich clotted cream and pistachios.',
    category: 'Beverages',
    price: 6000, // ₹60.00
    imageUrl: '/assets/images/menu/punjabi-lassi.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  {
    id: 'item_demo_14',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Cold Coffee with Ice Cream',
    description: 'Blended espresso and chilled milk served in a frosted mug topped with a scoop of vanilla ice cream.',
    category: 'Beverages',
    price: 9000, // ₹90.00
    imageUrl: '/assets/images/menu/cold-coffee.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  },
  // South Indian
  {
    id: 'item_demo_15',
    restaurantId: 'rst_campus_zaika_01',
    name: 'Masala Dosa with Chutneys',
    description: 'Crisp golden fermented rice crepe filled with tempered potato onion masala, with drumstick sambar.',
    category: 'South Indian',
    price: 11000, // ₹110.00
    imageUrl: '/assets/images/menu/masala-dosa.jpg',
    isAvailable: true,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(72)
  }
];

// ==========================================
// 4. DELIVERY PARTNERS (delivery_partners.json)
// ==========================================
export const deliveryPartners = [
  {
    id: 'del_01',
    userId: 'usr_courier_01',
    vehicleType: 'Motorcycle',
    isAvailable: true,
    activeOrderId: 'ord_demo_10', // Active assignment for Vikram
    totalDeliveries: 42,
    createdAt: hoursAgo(48),
    updatedAt: minutesAgo(15)
  },
  {
    id: 'del_02',
    userId: 'usr_courier_02',
    vehicleType: 'Electric Vehicle',
    isAvailable: true,
    activeOrderId: null, // Idle courier ready to claim available deliveries
    totalDeliveries: 28,
    createdAt: hoursAgo(36),
    updatedAt: hoursAgo(2)
  }
];

// ==========================================
// 5. ORDERS COLLECTION (orders.json)
// 16 orders representing all 9 canonical lifecycle states
// ==========================================
export const orders = [
  // 1. Placed (Ready for restaurant Accept / Reject actions)
  {
    id: 'ord_demo_01',
    customerId: 'usr_cust_01',
    customerName: 'Aarav Mehta',
    customerPhone: '+91 98765 33001',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Placed',
    items: [
      { itemId: 'item_demo_01', name: 'Butter Chicken with Naan', quantity: 1, price: 26000 },
      { itemId: 'item_demo_12', name: 'Kulhad Masala Chai', quantity: 2, price: 3500 }
    ],
    pricing: {
      subtotal: 33000,
      deliveryFee: 4000,
      tax: 1650,
      total: 38650
    },
    deliveryAddress: {
      street: 'Room 304, Boys Hostel Block B, South Campus Road',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(8),
      updatedAt: minutesAgo(8)
    }
  },
  // 2. Placed (Second pending order)
  {
    id: 'ord_demo_02',
    customerId: 'usr_cust_02',
    customerName: 'Priya Nair',
    customerPhone: '+91 98765 33002',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Placed',
    items: [
      { itemId: 'item_demo_09', name: 'Paneer Kathi Roll', quantity: 2, price: 11000 },
      { itemId: 'item_demo_13', name: 'Sweet Punjabi Lassi', quantity: 1, price: 6000 }
    ],
    pricing: {
      subtotal: 28000,
      deliveryFee: 4000,
      tax: 1400,
      total: 33400
    },
    deliveryAddress: {
      street: 'Wing 2, Kaveri Girls Hostel, University Campus',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(12),
      updatedAt: minutesAgo(12)
    }
  },
  // 3. Accepted (Ready for restaurant "Start Cooking" action)
  {
    id: 'ord_demo_03',
    customerId: 'usr_cust_03',
    customerName: 'Rohan Verma',
    customerPhone: '+91 98765 33003',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Accepted',
    items: [
      { itemId: 'item_demo_06', name: 'Veg Hakka Noodles', quantity: 1, price: 15000 },
      { itemId: 'item_demo_07', name: 'Chilli Paneer Dry', quantity: 1, price: 18000 }
    ],
    pricing: {
      subtotal: 33000,
      deliveryFee: 4000,
      tax: 1650,
      total: 38650
    },
    deliveryAddress: {
      street: 'Faculty Housing Qtr 12, West Gate Avenue',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(18),
      updatedAt: minutesAgo(15)
    }
  },
  // 4. Accepted (Second accepted order)
  {
    id: 'ord_demo_04',
    customerId: 'usr_cust_04',
    customerName: 'Ananya Sen',
    customerPhone: '+91 98765 33004',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Accepted',
    items: [
      { itemId: 'item_demo_03', name: 'Dal Makhani Student Special', quantity: 2, price: 16000 }
    ],
    pricing: {
      subtotal: 32000,
      deliveryFee: 4000,
      tax: 1600,
      total: 37600
    },
    deliveryAddress: {
      street: 'Dept of Computer Science, Lab 102, Tech Block',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(22),
      updatedAt: minutesAgo(19)
    }
  },
  // 5. Preparing (Ready for restaurant "Mark Ready" action)
  {
    id: 'ord_demo_05',
    customerId: 'usr_cust_05',
    customerName: 'Kunal Sood',
    customerPhone: '+91 98765 33005',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Preparing',
    items: [
      { itemId: 'item_demo_05', name: 'Schezwan Chicken Fried Rice', quantity: 1, price: 19000 },
      { itemId: 'item_demo_08', name: 'Chicken Steamed Momos (6 pcs)', quantity: 1, price: 13000 }
    ],
    pricing: {
      subtotal: 32000,
      deliveryFee: 4000,
      tax: 1600,
      total: 37600
    },
    deliveryAddress: {
      street: 'Room 410, Senior Boys Hostel, Campus Road',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(28),
      updatedAt: minutesAgo(20)
    }
  },
  // 6. Preparing (Second preparing order)
  {
    id: 'ord_demo_06',
    customerId: 'usr_cust_06',
    customerName: 'Neha Kapoor',
    customerPhone: '+91 98765 33006',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Preparing',
    items: [
      { itemId: 'item_demo_02', name: 'Paneer Tikka Masala', quantity: 1, price: 22000 },
      { itemId: 'item_demo_12', name: 'Kulhad Masala Chai', quantity: 2, price: 3500 }
    ],
    pricing: {
      subtotal: 29000,
      deliveryFee: 4000,
      tax: 1450,
      total: 34450
    },
    deliveryAddress: {
      street: 'Central Library Reading Hall, Desk 14',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(35),
      updatedAt: minutesAgo(25)
    }
  },
  // 7. Ready for Pickup (Available for Couriers to Claim!)
  {
    id: 'ord_demo_07',
    customerId: 'usr_cust_01',
    customerName: 'Aarav Mehta',
    customerPhone: '+91 98765 33001',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Ready for Pickup',
    items: [
      { itemId: 'item_demo_10', name: 'Egg Chicken Double Roll', quantity: 2, price: 14000 },
      { itemId: 'item_demo_14', name: 'Cold Coffee with Ice Cream', quantity: 1, price: 9000 }
    ],
    pricing: {
      subtotal: 37000,
      deliveryFee: 4000,
      tax: 1850,
      total: 42850
    },
    deliveryAddress: {
      street: 'Engineering Block 4, Robotics Lab, 2nd Floor',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(42),
      updatedAt: minutesAgo(10)
    }
  },
  // 8. Ready for Pickup (Available for Couriers to Claim!)
  {
    id: 'ord_demo_08',
    customerId: 'usr_cust_02',
    customerName: 'Priya Nair',
    customerPhone: '+91 98765 33002',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Ready for Pickup',
    items: [
      { itemId: 'item_demo_15', name: 'Masala Dosa with Chutneys', quantity: 2, price: 11000 },
      { itemId: 'item_demo_13', name: 'Sweet Punjabi Lassi', quantity: 2, price: 6000 }
    ],
    pricing: {
      subtotal: 34000,
      deliveryFee: 4000,
      tax: 1700,
      total: 39700
    },
    deliveryAddress: {
      street: 'University Administrative Block, Office 204',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(48),
      updatedAt: minutesAgo(14)
    }
  },
  // 9. Ready for Pickup (Available for Couriers to Claim!)
  {
    id: 'ord_demo_09',
    customerId: 'usr_cust_03',
    customerName: 'Rohan Verma',
    customerPhone: '+91 98765 33003',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Ready for Pickup',
    items: [
      { itemId: 'item_demo_11', name: 'Crispy Samosa Chaat', quantity: 2, price: 7000 },
      { itemId: 'item_demo_12', name: 'Kulhad Masala Chai', quantity: 4, price: 3500 }
    ],
    pricing: {
      subtotal: 28000,
      deliveryFee: 4000,
      tax: 1400,
      total: 33400
    },
    deliveryAddress: {
      street: 'Student Activity Centre, Badminton Court Area',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: minutesAgo(55),
      updatedAt: minutesAgo(18)
    }
  },
  // 10. Out for Delivery (Assigned to Courier Vikram del_01 - ACTIVE DELIVERY!)
  {
    id: 'ord_demo_10',
    customerId: 'usr_cust_04',
    customerName: 'Ananya Sen',
    customerPhone: '+91 98765 33004',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: 'del_01',
    status: 'Out for Delivery',
    items: [
      { itemId: 'item_demo_01', name: 'Butter Chicken with Naan', quantity: 1, price: 26000 },
      { itemId: 'item_demo_14', name: 'Cold Coffee with Ice Cream', quantity: 1, price: 9000 }
    ],
    pricing: {
      subtotal: 35000,
      deliveryFee: 4000,
      tax: 1750,
      total: 40750
    },
    deliveryAddress: {
      street: 'PG Hostel Wing A, Room 218, North Campus',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(1),
      updatedAt: minutesAgo(5)
    }
  },
  // 11. Picked Up (In transit between pickup and destination)
  {
    id: 'ord_demo_11',
    customerId: 'usr_cust_05',
    customerName: 'Kunal Sood',
    customerPhone: '+91 98765 33005',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: 'del_02',
    status: 'Picked Up',
    items: [
      { itemId: 'item_demo_07', name: 'Chilli Paneer Dry', quantity: 1, price: 18000 },
      { itemId: 'item_demo_06', name: 'Veg Hakka Noodles', quantity: 1, price: 15000 }
    ],
    pricing: {
      subtotal: 33000,
      deliveryFee: 4000,
      tax: 1650,
      total: 38650
    },
    deliveryAddress: {
      street: 'Sports Complex Pavilion, Main Stadium',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(1.2),
      updatedAt: minutesAgo(12)
    }
  },
  // 12. Delivered (Historical delivered order for Vikram del_01)
  {
    id: 'ord_demo_12',
    customerId: 'usr_cust_06',
    customerName: 'Neha Kapoor',
    customerPhone: '+91 98765 33006',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: 'del_01',
    status: 'Delivered',
    items: [
      { itemId: 'item_demo_05', name: 'Schezwan Chicken Fried Rice', quantity: 2, price: 19000 }
    ],
    pricing: {
      subtotal: 38000,
      deliveryFee: 4000,
      tax: 1900,
      total: 43900
    },
    deliveryAddress: {
      street: 'Girls Hostel Block C, Room 105, Campus Road',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(1.5)
    }
  },
  // 13. Delivered (Historical delivered order for Vikram del_01)
  {
    id: 'ord_demo_13',
    customerId: 'usr_cust_01',
    customerName: 'Aarav Mehta',
    customerPhone: '+91 98765 33001',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: 'del_01',
    status: 'Delivered',
    items: [
      { itemId: 'item_demo_02', name: 'Paneer Tikka Masala', quantity: 1, price: 22000 },
      { itemId: 'item_demo_12', name: 'Kulhad Masala Chai', quantity: 2, price: 3500 }
    ],
    pricing: {
      subtotal: 29000,
      deliveryFee: 4000,
      tax: 1450,
      total: 34450
    },
    deliveryAddress: {
      street: 'Boys Hostel Block B, Room 202',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(2.3)
    }
  },
  // 14. Delivered (Historical delivered order for Vikram del_01)
  {
    id: 'ord_demo_14',
    customerId: 'usr_cust_02',
    customerName: 'Priya Nair',
    customerPhone: '+91 98765 33002',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: 'del_01',
    status: 'Delivered',
    items: [
      { itemId: 'item_demo_03', name: 'Dal Makhani Student Special', quantity: 1, price: 16000 },
      { itemId: 'item_demo_13', name: 'Sweet Punjabi Lassi', quantity: 1, price: 6000 }
    ],
    pricing: {
      subtotal: 22000,
      deliveryFee: 4000,
      tax: 1100,
      total: 27100
    },
    deliveryAddress: {
      street: 'Kaveri Girls Hostel, Room 312',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(3.2)
    }
  },
  // 15. Cancelled (Customer cancelled before cooking began)
  {
    id: 'ord_demo_15',
    customerId: 'usr_cust_03',
    customerName: 'Rohan Verma',
    customerPhone: '+91 98765 33003',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Cancelled',
    items: [
      { itemId: 'item_demo_09', name: 'Paneer Kathi Roll', quantity: 1, price: 11000 }
    ],
    pricing: {
      subtotal: 11000,
      deliveryFee: 4000,
      tax: 550,
      total: 15550
    },
    deliveryAddress: {
      street: 'Room 108, Block A',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(4.9)
    }
  },
  // 16. Rejected (Restaurant declined due to kitchen capacity / out of stock)
  {
    id: 'ord_demo_16',
    customerId: 'usr_cust_04',
    customerName: 'Ananya Sen',
    customerPhone: '+91 98765 33004',
    restaurantId: 'rst_campus_zaika_01',
    restaurantName: 'Campus Zaika Central',
    deliveryPartnerId: null,
    status: 'Rejected',
    items: [
      { itemId: 'item_demo_04', name: 'Amritsari Kulcha with Chole', quantity: 2, price: 14000 }
    ],
    pricing: {
      subtotal: 28000,
      deliveryFee: 4000,
      tax: 1400,
      total: 33400
    },
    deliveryAddress: {
      street: 'Dept of Mathematics, Research Scholar Block',
      city: 'Bengaluru',
      pincode: '560029'
    },
    timestamps: {
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(5.8)
    }
  }
];

/**
 * Seeds all mock data collections into backend/data/ JSON files.
 */
export async function seedDemoData() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const tasks = [
    { file: 'users.json', data: users },
    { file: 'restaurants.json', data: restaurants },
    { file: 'menus.json', data: menus },
    { file: 'delivery_partners.json', data: deliveryPartners },
    { file: 'orders.json', data: orders }
  ];

  for (const { file, data } of tasks) {
    const filePath = path.join(DATA_DIR, file);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  console.log('✅ Zaykaa CE-1 Demo Mock Data seeded successfully:');
  console.log(`   - users.json: ${users.length} accounts (1 restaurant owner, 2 couriers, 6 customers)`);
  console.log(`   - restaurants.json: ${restaurants.length} restaurant profile (Campus Zaika Central)`);
  console.log(`   - menus.json: ${menus.length} dishes across 5 categories`);
  console.log(`   - delivery_partners.json: ${deliveryPartners.length} partner profiles (1 active, 1 idle)`);
  console.log(`   - orders.json: ${orders.length} orders spanning all 9 lifecycle states`);
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed-demo-data.js')) {
  seedDemoData().catch((err) => {
    console.error('❌ Failed to seed mock data:', err);
    process.exit(1);
  });
}
