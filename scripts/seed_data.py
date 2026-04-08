import subprocess


def main() -> None:
    subprocess.run(["docker", "compose", "exec", "backend", "python", "seed_data.py"], check=True)


if __name__ == "__main__":
    main()
