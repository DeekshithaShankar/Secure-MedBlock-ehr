import "semantic-ui-css/semantic.min.css";
import "../styles/globals.css";
import { BlockchainProvider } from "../context/entherum";

export default function App({ Component, pageProps }) {
  return (
    <BlockchainProvider>
      <Component {...pageProps} />
    </BlockchainProvider>
  );
}
