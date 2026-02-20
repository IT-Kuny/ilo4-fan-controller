# Another modded iLO4 Fan Controller for Gen 8 HP Servers

<p align="center">
  <img width="400" src="readme/screenshot.png">
  <br>
  <i>Freely manage your HP's fan speeds; anywhere, any time!</i>
</p>

---

## How this works

-   When you first load the page, a function runs through the [Next.js](https://nextjs.org/) `getServerSideProps` function which fetches the current data about the fan speeds of the server. This is then parsed and displayed on a form, allowing you to have even 20 fans if you want as it's all dynamically parsed.

-   Once you either apply the settings, or select a preset, the server connects via SSH to iLO4 and then runs the required commands, normally it takes about 10-20 seconds for all the commands to run through, but the more fans you have the longer it will take.

-   There's a REST API available which you can use for scripting and automation.

## Important Information

-   A **simple cookie-based login** protects the web UI and all API endpoints. Set `AUTH_USERNAME`, `AUTH_PASSWORD`, and `SESSION_SECRET` (≥ 32 characters) in your environment or `.env` file. Login is rate-limited (5 attempts per IP / 15 min). Note: rate limits are held in memory and reset on server restart; for multi-instance deployments behind a load balancer, add rate limiting at the reverse-proxy level or use a shared store such as Redis.

## REST API

The controller now exposes a small REST API for automation or scripting. All endpoints require an authenticated session cookie — log in via the web UI or `POST /api/auth/login` first.

-   `POST /api/auth/login` — authenticate with `{ "username": "...", "password": "..." }`.
-   `POST /api/auth/logout` — destroy the current session.
-   `GET /api/fans` — retrieves the current iLO fan data payload.
-   `POST /api/fans` — sets fan speeds using a JSON body like `{ "fans": [32, 32, 32, 32, 32, 32, 32, 32] }` (values are percentages).
-   `POST /api/fans/unlock` — unlocks global fan control.

Example usage with `curl`:

```bash
BASE_URL="http://ilo-fan-controller-ip.local:3000"
```

### - Log in (obtain session cookie)
```bash
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}' \
  -c cookies.txt | jq .
```

### - Unlock manual control
```bash
curl -s -X POST "$BASE_URL/api/fans/unlock" -b cookies.txt | jq .
```

### - Set all three fans to 40%
```bash
curl -s -X POST "$BASE_URL/api/fans" \
  -H 'Content-Type: application/json' \
  -d '{"fans":[40,40,40]}' -b cookies.txt | jq .
```

### - Read back actual values
```bash
curl -s "$BASE_URL/api/fans" -b cookies.txt | jq .
```

### - Log out
```bash
curl -s -X POST "$BASE_URL/api/auth/logout" -b cookies.txt | jq .
rm cookies.txt
```

## Installation

> The main requirement is that your iLO4 firmware is flashed with the _["The Fan Hack"](https://www.reddit.com/r/homelab/comments/hix44v/silence_of_the_fans_pt_2_hp_ilo_4_273_now_with/)_ mod.

## Docker

Clone the repository and build the Docker image, then run it with your configuration:

```bash
git clone https://github.com/0n1cOn3/ilo4-fan-controller
cd ilo4-fan-controller
docker build -t local/ilo4-fan-controller:latest-local .
```

```bash
docker run -d \
  --name=ilo4-fan-controller \
  -p 3000:3000 \
  -e ILO_USERNAME='*your username*' \
  -e ILO_PASSWORD='*your password*' \
  -e ILO_HOST='*the ip address you access ILO on*' \
  -e AUTH_USERNAME='admin' \
  -e AUTH_PASSWORD='*your strong login password*' \
  -e SESSION_SECRET='*random string, at least 32 characters*' \
  --restart unless-stopped \
  local/ilo4-fan-controller:latest-local
```

You can modify this to work with Rancher, Portainer, etc.

## Directly with node

On your desired machine, clone down the repository and make a copy of the `.env.template` into `.env` and fill in **your** values.

```env
ILO_HOST=192.168.1.100
ILO_USERNAME=your_ilo_username
ILO_PASSWORD=your_ilo_password

AUTH_USERNAME=admin
AUTH_PASSWORD=your_strong_password_here
SESSION_SECRET=random_string_at_least_32_characters_long
```

Before you do anything you first need to build the project:

```shell
# fetches the dependencies
yarn

# builds the nextjs project
yarn build
```

You can then create a `systemd` service, use `pm2`, or just run it directly:

```shell
yarn start
```

## The Idea

HP offers enterprise servers which are normally supposed to be in some sort of datacenter environment, where things such as fan speed are not really a concern. With this in mind, when old HPE servers are decommissioned and put on the used market, people like myself buy these servers to have them part of our _Home Datacenter_.

These servers can easily start sounding like an airplane is starting to take off at your house, so modified firmwares of the server's IPMI system (iLO4) have been created in order to manage the fan speeds via SSH, but when your power goes off and you need to change the fan speed from your phone, that's a whole different story. The main inspiration for this project was this post I found on [r/homelab](https://www.reddit.com/r/homelab/comments/rcel73/i_created_a_web_page_to_manage_the_fans_of_my/), but I decided to create my own so that I can make it as customizable as possible and not have it restricted to some models.
