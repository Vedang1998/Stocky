import { render } from "preact";
import { useState } from "preact/hooks";
import { Receive } from "./Receive";
import { StockLookup } from "./StockLookup";
import { TransferReceive } from "./TransferReceive";

export default async () => {
  render(<ProPo />, document.body);
};

type Screen = "menu" | "lookup" | "receive" | "transfer";

function ProPo() {
  const [screen, setScreen] = useState<Screen>("menu");
  const back = () => setScreen("menu");

  if (screen === "lookup") return <StockLookup onBack={back} />;
  if (screen === "receive") return <Receive onBack={back} />;
  if (screen === "transfer") return <TransferReceive onBack={back} />;

  return (
    <s-page heading="ProPo">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="primary" onClick={() => setScreen("lookup")}>
              Look up stock
            </s-button>
            <s-button onClick={() => setScreen("receive")}>
              Receive a delivery
            </s-button>
            <s-button onClick={() => setScreen("transfer")}>
              Receive a transfer
            </s-button>
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}
