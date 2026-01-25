export type AvatarItem = {
    name: string;
    price: number;
    icon: string; // Emoji
    filename: string;
};

export const AVATARS: AvatarItem[] = [
    // Originals
    { name: 'Default Dog', price: 0, icon: '🐕', filename: '/assets/idle.png' },
    { name: 'Cool Dog', price: 500, icon: '😎', filename: '/assets/avatar_cool.png' },
    { name: 'Fast Dog', price: 750, icon: '👟', filename: '/assets/avatar_fast.png' },
    { name: 'Gorilla', price: 2000, icon: '🦍', filename: '/assets/avatar_gorilla.png' },
    { name: 'Elephant', price: 5000, icon: '🐘', filename: '/assets/avatar_elephant.png' },

    // Animals
    { name: 'Cat', price: 1000, icon: '🐱', filename: '/assets/avatar_cat.png' },
    { name: 'Lion', price: 2500, icon: '🦁', filename: '/assets/avatar_lion.png' },
    { name: 'Tiger', price: 2500, icon: '🐯', filename: '/assets/avatar_tiger.png' },
    { name: 'Bear', price: 2200, icon: '🐻', filename: '/assets/avatar_bear.png' },
    { name: 'Panda', price: 3000, icon: '🐼', filename: '/assets/avatar_panda.png' },
    { name: 'Fox', price: 1500, icon: '🦊', filename: '/assets/avatar_fox.png' },
    { name: 'Wolf', price: 1800, icon: '🐺', filename: '/assets/avatar_wolf.png' },
    { name: 'Bunny', price: 800, icon: '🐰', filename: '/assets/avatar_bunny.png' },
    { name: 'Hamster', price: 600, icon: '🐹', filename: '/assets/avatar_hamster.png' },
    { name: 'Mouse', price: 500, icon: '🐭', filename: '/assets/avatar_mouse.png' },
    { name: 'Pig', price: 1200, icon: '🐷', filename: '/assets/avatar_pig.png' },
    { name: 'Cow', price: 1500, icon: '🐮', filename: '/assets/avatar_cow.png' },
    { name: 'Sheep', price: 1400, icon: '🐑', filename: '/assets/avatar_sheep.png' },
    { name: 'Penguin', price: 2000, icon: '🐧', filename: '/assets/avatar_penguin.png' },
    { name: 'Duck', price: 900, icon: '🦆', filename: '/assets/avatar_duck.png' },
    { name: 'Frog', price: 1100, icon: '🐸', filename: '/assets/avatar_frog.png' },
    { name: 'Turtle', price: 1600, icon: '🐢', filename: '/assets/avatar_turtle.png' },
    { name: 'Snake', price: 1300, icon: '🐍', filename: '/assets/avatar_snake.png' },
    { name: 'Crocodile', price: 2800, icon: '🐊', filename: '/assets/avatar_crocodile.png' },
    { name: 'Shark', price: 3500, icon: '🦈', filename: '/assets/avatar_shark.png' },

    // Fantasy
    { name: 'Dragon', price: 10000, icon: '🐉', filename: '/assets/avatar_dragon.png' },
    { name: 'Unicorn', price: 8000, icon: '🦄', filename: '/assets/avatar_unicorn.png' },
    { name: 'Alien', price: 5000, icon: '👽', filename: '/assets/avatar_alien.png' },
    { name: 'Robot', price: 4500, icon: '🤖', filename: '/assets/avatar_robot.png' },
    { name: 'Zombie', price: 3000, icon: '🧟', filename: '/assets/avatar_zombie.png' },
    { name: 'Skeleton', price: 2500, icon: '💀', filename: '/assets/avatar_skeleton.png' },
    { name: 'Ghost', price: 2000, icon: '👻', filename: '/assets/avatar_ghost.png' },
    { name: 'Vampire', price: 4000, icon: '🧛', filename: '/assets/avatar_vampire.png' },
    { name: 'Ninja', price: 4000, icon: '🥷', filename: '/assets/avatar_ninja.png' },
    { name: 'Wizard', price: 6000, icon: '🧙', filename: '/assets/avatar_wizard.png' },

    // Costumed Dogs (or just cool characters)
    { name: 'Astronaut', price: 7000, icon: '👨‍🚀', filename: '/assets/avatar_astronaut.png' },
    { name: 'Pirate', price: 3500, icon: '🏴‍☠️', filename: '/assets/avatar_pirate.png' },
    { name: 'King', price: 9000, icon: '👑', filename: '/assets/avatar_king.png' },
    { name: 'Queen', price: 9000, icon: '👸', filename: '/assets/avatar_queen.png' },
    { name: 'Chef', price: 1500, icon: '👨‍🍳', filename: '/assets/avatar_chef.png' },
    { name: 'Doctor', price: 3000, icon: '👨‍⚕️', filename: '/assets/avatar_doctor.png' },
    { name: 'Police', price: 2500, icon: '👮', filename: '/assets/avatar_police.png' },
    { name: 'Firefighter', price: 2800, icon: '👨‍🚒', filename: '/assets/avatar_firefighter.png' },
    { name: 'Cowboy', price: 3200, icon: '🤠', filename: '/assets/avatar_cowboy.png' },
    { name: 'Clown', price: 1000, icon: '🤡', filename: '/assets/avatar_clown.png' },

    // Misc
    { name: 'Snowman', price: 1500, icon: '⛄', filename: '/assets/avatar_snowman.png' },
    { name: 'Pumpkin', price: 1200, icon: '🎃', filename: '/assets/avatar_pumpkin.png' },
    { name: 'Cactus', price: 1800, icon: '🌵', filename: '/assets/avatar_cactus.png' },
    { name: 'Hotdog', price: 5000, icon: '🌭', filename: '/assets/avatar_hotdog.png' },
    { name: 'Burger', price: 4000, icon: '🍔', filename: '/assets/avatar_burger.png' },
    { name: 'Pizza', price: 4500, icon: '🍕', filename: '/assets/avatar_pizza.png' },
    { name: 'T-Rex', price: 8500, icon: '🦖', filename: '/assets/avatar_trex.png' },

    // Legendary
    { name: 'Diamond Dog', price: 50000, icon: '💎', filename: '/assets/avatar_diamond_dog.png' },
    { name: 'Rainbow Unicorn', price: 75000, icon: '🌈', filename: '/assets/avatar_rainbow_unicorn.png' },
    { name: 'Phoenix', price: 100000, icon: '🔥', filename: '/assets/avatar_phoenix.png' },

    // God Tier
    { name: 'Golden Munchkin Cat', price: 1000000, icon: '✨', filename: '/assets/avatar_golden_munchkin.png' }
];
