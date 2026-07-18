import { App } from "../src/App.jsx";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  return <App />;
}
