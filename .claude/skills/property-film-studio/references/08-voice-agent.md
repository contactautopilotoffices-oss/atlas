# 08: Next. A voice agent for the property ("ask the building")

The aim is that a Flipkart visitor can ask out loud, "How far is Corporate
Avenue from the metro?" The agent answers in Alka's voice and the explorer
flies there.

## Build it on ElevenLabs Agents (Conversational AI)

Check the current API at elevenlabs.io/docs before building; the names
below were right in late 2026.

1. **Create the agent** in the ElevenLabs dashboard or through the API:
   - **Voice:** the film's voice (Alka), so the page and the film sound
     like one product.
   - **System prompt:**

     > "You are the Autopilot guide for <client>'s office shortlist in
     > <area>. Answer only from the knowledge base. If a figure isn't there,
     > say you'll check with the Autopilot team. Keep answers under two
     > sentences. Never quote rent unless asked and it is in the knowledge
     > base."

   - **Knowledge base:**
     - the canonical table, exported as markdown;
     - the script;
     - the brochure text;
     - the metro and walk data.

     Never include internal notes or open founder questions.
   - **First message:** "Hi, I'm your guide to the three buildings. Ask me
     anything, or say 'show me Privilon'."
   - **Language:** English, with Hindi allowed.
2. **Client tools**, which the page carries out. Declare them on the agent
   and implement them in JS:
   - `fly_to({property})`: calls the explorer's navigation
     (`andheri-navigation.js`).
   - `show_plan({property, option})`: opens the CAD fit-out.
   - `set_time({preset: "day"|"dusk"|"night"})`: the lighting controls.
   - `show_walk({property})`: plays the metro walk.
3. **Embed it:**
   - **Quickest:** the widget,
     `<elevenlabs-convai agent-id="...">`, plus the
     `@elevenlabs/convai-widget-embed` script. This only suits a public
     agent.
   - **Better, for a private agent:**
     - a Vercel serverless function (`api/agent-url.js`) calls
       `GET /v1/convai/conversation/get-signed-url?agent_id=...` with the
       `xi-api-key` from a Vercel env var;
     - the page calls `Conversation.startSession({ signedUrl, clientTools })`
       from `@elevenlabs/client`.

     The key never reaches the browser.
4. **Gate it** behind the same access login as the atlas. Show a mic
   button only after Enter, ask for mic permission, and keep a text
   fallback.
5. **Costs and logs.** Agent minutes are billed. Set a maximum call length
   (3 to 5 min). Read transcripts in the dashboard to see what clients
   ask, and feed those questions into the next film.

## Quality bar

- Every spoken figure must match the knowledge base. Test with 20 scripted
  questions, including traps (rent, competitors, the floors we're unsure
  of).
- Latency under about 1 s to the first word.
- It never invents a building, a distance or an amenity.
