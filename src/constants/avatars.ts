export type AvatarItem = {
    name: string;
    price: number;
    icon: string; // Emoji
    filename: string;
};

export const AVATARS: AvatarItem[] = [
    // Free
    { name: 'Default Dog', price: 0, icon: '🐕', filename: '/assets/idle.png' },

    // Tier 1 (Starter)
    { name: 'Mouse', price: 1000, icon: '🐭', filename: '/assets/avatar_mouse.png' },
    { name: 'Bunny', price: 1500, icon: '🐰', filename: '/assets/avatar_bunny.png' },
    { name: 'Cat', price: 2000, icon: '🐱', filename: '/assets/avatar_cat.png' },
    { name: 'Hamster', price: 2500, icon: '🐹', filename: '/assets/avatar_hamster.png' },
    { name: 'Cool Dog', price: 3000, icon: '😎', filename: '/assets/avatar_cool.png' },

    // Tier 2 (Common)
    { name: 'Duck', price: 5000, icon: '🦆', filename: '/assets/avatar_duck.png' },
    { name: 'Fast Dog', price: 6000, icon: '👟', filename: '/assets/avatar_fast.png' },
    { name: 'Frog', price: 7000, icon: '🐸', filename: '/assets/avatar_frog.png' },
    { name: 'Clown', price: 8000, icon: '🤡', filename: '/assets/avatar_clown.png' },
    { name: 'Pig', price: 9000, icon: '🐷', filename: '/assets/avatar_pig.png' },
    { name: 'Snake', price: 10000, icon: '🐍', filename: '/assets/avatar_snake.png' },
    { name: 'Pumpkin', price: 11000, icon: '🎃', filename: '/assets/avatar_pumpkin.png' },
    { name: 'Sheep', price: 12000, icon: '🐑', filename: '/assets/avatar_sheep.png' },
    { name: 'Fox', price: 14000, icon: '🦊', filename: '/assets/avatar_fox.png' },
    { name: 'Cow', price: 15000, icon: '🐮', filename: '/assets/avatar_cow.png' },

    // Tier 3 (Uncommon)
    { name: 'Chef', price: 20000, icon: '👨‍🍳', filename: '/assets/avatar_chef.png' },
    { name: 'Snowman', price: 22000, icon: '⛄', filename: '/assets/avatar_snowman.png' },
    { name: 'Turtle', price: 24000, icon: '🐢', filename: '/assets/avatar_turtle.png' },
    { name: 'Cactus', price: 26000, icon: '🌵', filename: '/assets/avatar_cactus.png' },
    { name: 'Ghost', price: 28000, icon: '👻', filename: '/assets/avatar_ghost.png' },
    { name: 'Penguin', price: 30000, icon: '🐧', filename: '/assets/avatar_penguin.png' },
    { name: 'Wolf', price: 35000, icon: '🐺', filename: '/assets/avatar_wolf.png' },
    { name: 'Gorilla', price: 40000, icon: '🦍', filename: '/assets/avatar_gorilla.png' },

    // Tier 4 (Rare)
    { name: 'Bear', price: 50000, icon: '🐻', filename: '/assets/avatar_bear.png' },
    { name: 'Lion', price: 60000, icon: '🦁', filename: '/assets/avatar_lion.png' },
    { name: 'Tiger', price: 65000, icon: '🐯', filename: '/assets/avatar_tiger.png' },
    { name: 'Skeleton', price: 70000, icon: '💀', filename: '/assets/avatar_skeleton.png' },
    { name: 'Police', price: 75000, icon: '👮', filename: '/assets/avatar_police.png' },
    { name: 'Cowboy', price: 80000, icon: '🤠', filename: '/assets/avatar_cowboy.png' },
    { name: 'Doctor', price: 85000, icon: '👨‍⚕️', filename: '/assets/avatar_doctor.png' },
    { name: 'Firefighter', price: 90000, icon: '👨‍🚒', filename: '/assets/avatar_firefighter.png' },

    // Tier 5 (Epic)
    { name: 'Crocodile', price: 100000, icon: '🐊', filename: '/assets/avatar_crocodile.png' },
    { name: 'Panda', price: 110000, icon: '🐼', filename: '/assets/avatar_panda.png' },
    { name: 'Zombie', price: 120000, icon: '🧟', filename: '/assets/avatar_zombie.png' },
    { name: 'Pirate', price: 130000, icon: '🏴‍☠️', filename: '/assets/avatar_pirate.png' },
    { name: 'Shark', price: 140000, icon: '🦈', filename: '/assets/avatar_shark.png' },
    { name: 'Burger', price: 150000, icon: '🍔', filename: '/assets/avatar_burger.png' },
    { name: 'Vampire', price: 175000, icon: '🧛', filename: '/assets/avatar_vampire.png' },
    { name: 'Ninja', price: 200000, icon: '🥷', filename: '/assets/avatar_ninja.png' },
    { name: 'Pizza', price: 225000, icon: '🍕', filename: '/assets/avatar_pizza.png' },
    { name: 'Robot', price: 250000, icon: '🤖', filename: '/assets/avatar_robot.png' },

    // Tier 6 (Legendary)
    { name: 'Elephant', price: 300000, icon: '🐘', filename: '/assets/avatar_elephant.png' },
    { name: 'Alien', price: 350000, icon: '👽', filename: '/assets/avatar_alien.png' },
    { name: 'Hotdog', price: 400000, icon: '🌭', filename: '/assets/avatar_hotdog.png' },
    { name: 'Unicorn', price: 450000, icon: '🦄', filename: '/assets/avatar_unicorn.png' },
    { name: 'Astronaut', price: 500000, icon: '👨‍🚀', filename: '/assets/avatar_astronaut.png' },
    { name: 'T-Rex', price: 600000, icon: '🦖', filename: '/assets/avatar_trex.png' },
    { name: 'Wizard', price: 700000, icon: '🧙', filename: '/assets/avatar_wizard.png' },
    { name: 'Dragon', price: 800000, icon: '🐉', filename: '/assets/avatar_dragon.png' },

    // Tier 7 (Mythic)
    { name: 'King', price: 900000, icon: '👑', filename: '/assets/avatar_king.png' },
    { name: 'Queen', price: 900000, icon: '👸', filename: '/assets/avatar_queen.png' },
    { name: 'Diamond Dog', price: 900000, icon: '💎', filename: '/assets/avatar_diamond_dog.png' },
    { name: 'Rainbow Unicorn', price: 950000, icon: '🌈', filename: '/assets/avatar_rainbow_unicorn.png' },
    { name: 'Phoenix', price: 999999, icon: '🔥', filename: '/assets/avatar_phoenix.png' },

    // Tier 8 (God)
    { name: 'Golden Munchkin Cat', price: 1000000, icon: '✨', filename: '/assets/avatar_golden_munchkin.png' }
];
