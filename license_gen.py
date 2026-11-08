import secrets

def generate_key_pool(num_keys=10):
    print("Generated License Keys (Ready to distribute):\n" + "-"*35)
    keys = []
    for _ in range(num_keys):
        # Generates a random secure key format: XXXX-XXXX-XXXX-XXXX
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        part3 = secrets.token_hex(2).upper()
        part4 = secrets.token_hex(2).upper()
        key = f"{part1}-{part2}-{part3}-{part4}"
        keys.append(key)
        print(key)
    print("-" * 35)

if __name__ == "__main__":
    generate_key_pool(5) # Generates 5 keys