import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import globalStylesHref from "./styles/global.css?url";

export const links = () => [{ rel: "stylesheet", href: globalStylesHref }];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,100..900;1,100..900&display=swap"
        />
        <Meta />
        <Links />
      </head>
      <body style={{ fontFamily: '"Jost", sans-serif' }}>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
