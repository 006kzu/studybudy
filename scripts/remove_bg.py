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
    "avatar_ghost.png",
    "avatar_vampire.png",
    "avatar_ninja.png",
    "avatar_wizard.png",
    "avatar_astronaut.png",
    "avatar_pirate.png",
    "avatar_king.png",
    "avatar_queen.png",
    "avatar_chef.png",
    "avatar_doctor.png",
    "avatar_police.png",
    "avatar_firefighter.png",
    "avatar_cowboy.png",
    "avatar_clown.png",
    "avatar_snowman.png",
    "avatar_pumpkin.png",
    "avatar_cactus.png",
    "avatar_hotdog.png",
    "avatar_burger.png",
    "avatar_pizza.png",
    "avatar_trex.png"
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
