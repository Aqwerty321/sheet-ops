import GlobalClickSpark from "./components/GlobalClickSpark";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@redwoodjs/starter-minimal</title>
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      <div id="root">
        <GlobalClickSpark>{children}</GlobalClickSpark>
      </div>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
