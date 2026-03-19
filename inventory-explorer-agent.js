const {
  definePrismAgent,
  toPrismError,
} = await import("https://prismcustomagentregistry.blob.core.windows.net/custom-agents/src/index.js");

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .panel {
      border: 1px solid #d7deea;
      border-radius: 16px;
      background: linear-gradient(180deg, #ffffff, #f3f7fb);
      padding: 20px;
    }

    h2 {
      margin: 0 0 12px;
      font: 600 20px/1.2 Georgia, serif;
      color: #183153;
    }

    p {
      margin: 0 0 12px;
      color: #41536a;
    }

    .debug {
      border-radius: 12px;
      background: #eef5fb;
      color: #183153;
      font: 600 12px/1.4 "Segoe UI", system-ui, sans-serif;
      margin-bottom: 12px;
      padding: 10px 12px;
    }

    button {
      border: 0;
      border-radius: 999px;
      background: #183153;
      color: #ffffff;
      cursor: pointer;
      padding: 10px 16px;
    }

    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    pre {
      overflow: auto;
      border-radius: 12px;
      background: #0c1828;
      color: #f7fbff;
      margin: 16px 0 0;
      padding: 14px;
      white-space: pre-wrap;
    }
  </style>
  <section class="panel">
    <h2>Inventory Explorer</h2>
    <div class="debug" data-role="debug">Waiting for Prism registration context.</div>
    <p data-role="summary">Waiting for Prism session context.</p>
    <button type="button">Load sample BAQ</button>
    <pre data-role="output" hidden></pre>
  </section>
`;

function ensureView(root) {
  if (!root.querySelector('[data-role="summary"]')) {
    root.innerHTML = "";
    root.append(template.content.cloneNode(true));
  }

  return {
    debug: root.querySelector('[data-role="debug"]'),
    summary: root.querySelector('[data-role="summary"]'),
    button: root.querySelector("button"),
    output: root.querySelector('[data-role="output"]'),
  };
}

export const InventoryExplorerAgent = definePrismAgent("inventory-explorer-agent", {
  registration: {
    agentId: "inventory-explorer",
    manifestVersion: "0.1",
  },
  title: "Inventory Explorer",

  async initialize({ host, prism, root }) {
    const view = ensureView(root);

    view.debug.textContent = `Runtime agent: ${prism.agent?.id ?? "unknown"} | manifest: ${prism.agent?.manifestVersion ?? "unknown"}`;

    if (view.button.dataset.bound === "true") {
      return;
    }

    view.button.dataset.bound = "true";
    view.button.addEventListener("click", async () => {
      view.button.disabled = true;
      view.output.hidden = false;
      view.output.textContent = "Loading...";

      try {
        const result = await host.callService({
          service: "CallBAQ",
          input: {
            baqId: "InventoryByWarehouse",
            parameters: {
              PartNum: "TEST-PART",
            },
            paging: {
              page: 1,
              pageSize: 10,
            },
          },
        });

        const rows = result.data?.rows ?? result.rows ?? [];

        await host.setStorage({
          key: "inventory-explorer:last-query",
          value: {
            baqId: "InventoryByWarehouse",
            rowCount: rows.length,
          },
        });

        view.output.textContent = JSON.stringify(rows, null, 2);
      } catch (error) {
        view.output.textContent = JSON.stringify(toPrismError(error), null, 2);
      } finally {
        view.button.disabled = false;
      }
    });
  },

  connect({ host, prism, root }) {
    const view = ensureView(root);
    view.debug.textContent = `Runtime agent: ${prism.agent?.id ?? "unknown"} | manifest: ${prism.agent?.manifestVersion ?? "unknown"}`;
    view.summary.textContent = `Connected as ${prism.session.userId} in ${prism.context.erp}.`;

    host.subscribe("context.changed", (nextContext) => {
      view.summary.textContent = `Context updated to ${nextContext.erp}.`;
    });
  },

  render({ prism, root }) {
    if (!prism) {
      root.innerHTML = `
        <section>
          <strong>Inventory Explorer</strong>
          <p>Waiting for Prism to assign the host bridge.</p>
        </section>
      `;
      return;
    }

    ensureView(root);
  },
});
