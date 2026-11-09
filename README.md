# RailRadar

A live map of trains in Sweden. Follow trains in real time and click one to see its details.

**Live:** https://railradar.se

<img width="1368" height="855" alt="railradar" src="https://github.com/user-attachments/assets/a4051fe2-8dfa-4d4d-a1f5-49a900bf4c19" />

<br>

<!-- Add a screenshot here -->

## Features

- **Live map** - See train positions across Sweden in real time
- **Train details** - Click a train to see its route, speed and more
- **Light and dark mode** - Follows your device setting

## Technologies

- React, TypeScript, Tailwind CSS, Vite
- MapLibre GL JS (map)
- Node.js, Express
- PostgreSQL, Docker

Built with the help of Claude Code. Train data comes from https://data.trafikverket.se/home

## Getting started

### Prerequisites

- Node.js 26 or newer
- Docker
- A free Trafikverket API key

### Installation

1. Clone the repository:

```
git clone https://github.com/Teodor29/railradar.git
cd railradar
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file from the example and add your API key:

```
cp .env.example .env
```

4. Start the app (this also starts Postgres in Docker):

```
npm run dev
```

## Project structure

```
apps/web         Frontend (React + Vite)
apps/api         Backend (Express)
packages/shared  Types and validation shared by both
```
