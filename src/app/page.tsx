"use client";

import { useState } from "react";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({ found: 0, expanded: 0 });

  const handleRestore = async () => {
    if (!inputText) return;

    setIsLoading(true);
    setStats({ found: 0, expanded: 0 });

    try {
      // 1. Regex to find lnkd.in URLs
      // Matches https://lnkd.in/xxxxxx or http://lnkd.in/xxxxxx
      // Word characters only to avoid trailing punctuation like . at end of sentence
      const regex = /https?:\/\/lnkd\.in\/[\w-]+/g;
      const matches = inputText.match(regex);

      if (!matches || matches.length === 0) {
        setOutputText(inputText); // No links, just copy
        setIsLoading(false);
        return;
      }

      setStats(prev => ({ ...prev, found: matches.length }));

      // 2. Call API
      const response = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: matches }),
      });

      const data = await response.json();

      if (data.error) {
        console.error(data.error);
        alert("Failed to expand links. Please try again.");
        return;
      }

      // 3. Create replacement map
      const expansionMap = new Map();
      data.results.forEach((item: { original: string; expanded: string }) => {
        expansionMap.set(item.original, item.expanded);
      });

      // 4. Replace in text
      let newText = inputText;
      // We replace all occurrences using a function to handle duplicates correctly
      newText = newText.replace(regex, (match) => {
        return expansionMap.get(match) || match;
      });

      setOutputText(newText);
      setStats({ found: matches.length, expanded: data.results.length });

    } catch (error) {
      console.error("Error:", error);
      alert("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText).then(() => {
      // Could add toast here
      const btn = document.getElementById("copyBtn");
      if (btn) {
        const originalText = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = originalText, 2000);
      }
    });
  };

  return (
    <main className="container">
      <header className="header">
        <h1>LinkedIn Link Restorer</h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          Recover original URLs from lnkd.in short links while keeping your text format.
        </p>
      </header>

      <div className="app-grid">
        {/* Input Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Input Text</h2>
          </div>
          <textarea
            placeholder="Paste your LinkedIn post here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            spellCheck={false}
          />
          <button
            className="btn-primary"
            onClick={handleRestore}
            disabled={isLoading || !inputText}
            style={{ opacity: isLoading || !inputText ? 0.7 : 1, cursor: isLoading || !inputText ? 'not-allowed' : 'pointer' }}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner"></div>
                <span>Restoring...</span>
              </>
            ) : (
              "Restore Links"
            )}
          </button>
        </div>

        {/* Output Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              Result
              {stats.found > 0 && <span style={{ fontSize: '0.8em', marginLeft: '0.5rem', color: 'var(--success)' }}>({stats.found} links expanded)</span>}
            </h2>
            <button
              id="copyBtn"
              className="btn-copy"
              onClick={copyToClipboard}
              disabled={!outputText}
            >
              Copy
            </button>
          </div>
          <textarea
            readOnly={false} // Allow manual edits if needed? PRD says "Output (Textarea) ... (수정 가능)"
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="Result will appear here..."
          />
        </div>
      </div>
    </main>
  );
}
