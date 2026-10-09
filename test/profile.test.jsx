import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Profile from "../src/pages/Profile.jsx";

describe("Profile Page Render", () => {
  const dummyStats = {
    played: 10,
    bestScore: 95,
    accuracy: 90,
    streak: 4,
  };
  const dummyRecentGames = [
    { id: 1, type: "Standard", won: true, score: 95, timestamp: Date.now() },
  ];

  it("renders correctly with a connected wallet address", () => {
    const html = renderToStaticMarkup(
      <Profile
        stats={dummyStats}
        recentGames={dummyRecentGames}
        walletAddress="GD3VW6CXVC2IEP23QWLHY6E2TLJCJI436FTLAYI3VC73YETPSW2ZQ3DY"
        onConnectWallet={() => {}}
        onDisconnectWallet={() => {}}
      />
    );
    expect(html).toContain("Connected Wallet");
    expect(html).toContain("Unresolved Staked Rounds");
    expect(html).toContain("Lifetime Statistics");
    expect(html).toContain("Match History");
  });

  it("renders correctly without a wallet address (disconnected state)", () => {
    const html = renderToStaticMarkup(
      <Profile
        stats={dummyStats}
        recentGames={[]}
        walletAddress={null}
        onConnectWallet={() => {}}
        onDisconnectWallet={() => {}}
      />
    );
    expect(html).toContain("No wallet connected");
    expect(html).toContain("Connect Wallet");
    expect(html).toContain("No games played yet");
  });
});
