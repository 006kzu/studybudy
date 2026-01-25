import os
import requests
import sys

# Usage: python3 remove_bg.py <api_key> <directory>

API_KEY = sys.argv[1]
DIRECTORY = sys.argv[2]
URL = "https://api.remove.bg/v1.0/removebg"

print(f"Scanning {DIRECTORY} for PNGs...")

# List of files to definitely process (the ones we just generated)
# We can just process everything that isn't already processed? 
# Or just force process specific ones.
# For safety/cost, let's look for specific patterns or just process the ones I know I made.
# The user said "Run all the images you made".
# I'll rely on a list of known new files.

TARGETS = [
    "avatar_golden_munchkin.png",
    "avatar_diamond_dog.png",
    "avatar_rainbow_unicorn.png",
    "avatar_phoenix.png",
    "avatar_sheep.png",
    "avatar_penguin.png",
    "avatar_duck.png",
    "avatar_frog.png",
    "avatar_turtle.png",
    "avatar_snake.png",
    "avatar_crocodile.png",
    "avatar_shark.png",
    "avatar_dragon.png",
    "avatar_unicorn.png",
    "avatar_alien.png",
    "avatar_robot.png",
    "avatar_zombie.png",
    "avatar_skeleton.png"
]

for filename in os.listdir(DIRECTORY):
    if filename in TARGETS:
        filepath = os.path.join(DIRECTORY, filename)
        print(f"Processing {filename}...")
        
        with open(filepath, 'rb') as image_file:
            response = requests.post(
                URL,
                files={'image_file': image_file},
                data={'size': 'auto'},
                headers={'X-Api-Key': API_KEY},
            )
            
        if response.status_code == 200:
            with open(filepath, 'wb') as out:
                out.write(response.content)
            print(f"SUCCESS: {filename} background removed.")
        else:
            print(f"FAILED: {filename} - {response.status_code} {response.text}")

print("Done.")
