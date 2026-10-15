/* ===========================================================================
   NARRATION SCRIPTS — Homework H1 (was Period 2)
   ---------------------------------------------------------------------------
   This file is the teaching content. Edit the wording here; nothing in
   script.js needs to change.

   Each section maps to an array of segments. Per segment:
     focus  the data-focus key of the node to light in that section's chain
     cap    one line under the chain, summarising the beat
     text   what is said (audio) AND shown (reading mode) — same words, so a
            student who can't play sound gets the identical lesson

   Spell awkward initialisms phonetically for the speech engine (D N S, I P);
   they are normalised back for the on-screen text by script.js.
   ======================================================================== */
window.FA5P2_NARRATION = {

  /* ------------------------------------------------- SECTION 1: the journey */
  "sec-1": [
    { focus:"msg", cap:"One message, about to stop being one thing.",
      text:"You ask for a web page. Somewhere a server has that page ready to send you. The obvious way to do that would be to open a connection and pour the whole thing down it, start to finish, like water through a pipe. That is not what happens." },

    { focus:"split", cap:"Split first. Address every piece.",
      text:"Before anything leaves the server, the page is chopped into small pieces called packets. Each one is stamped with where it came from, where it is going, and — this matters — what number it is in the sequence. Piece one, piece two, piece three. They are now independent. Nothing holds them together except those numbers." },

    { focus:"routes", cap:"Independent means they don't travel together.",
      text:"Between you and the server sit routers: devices whose only job is to pass each packet one step closer to where it is going. Because packets are independent, they do not have to travel together. Packet one might go through Sydney. Packet two, sent a fraction of a second later, might take a completely different path because that first route just got busy. The network decides, packet by packet, moment by moment. That sounds messy and fragile, but the opposite is true." },

    { focus:"fail", cap:"The thing that would break a pipe barely touches this.",
      text:"Imagine a router somewhere in the middle fails. If we had a single pipe running through it, the transfer dies. Everything stops, and you start again. But with packets, there is no single pipe to break. The next packet simply gets routed around the failure and keeps going. The network is not one path. It is a mesh of thousands of possible paths, and packets find their way through it. Failure stops being catastrophic and becomes something the system routes around without you ever noticing." },

    { focus:"reasm", cap:"Out of order is normal. Sequence numbers fix it.",
      text:"So packets arrive out of order. Packet three turns up before packet two, because it took a quicker route. That is completely normal, and it is fine — because every packet is carrying its sequence number. The receiving machine just reads those numbers and reassembles the pieces into the right order before handing the page to your browser. You see a page loading. You never see the reordering. Here is the idea to take away: splitting data into independently routed packets is not a compromise the internet makes. It is the thing that makes the internet work at all." }
  ],

  /* ----------------------------------------------------- SECTION 2: packets */
  "sec-2": [
    { focus:"header", cap:"The header: where from, where to, which one.",
      text:"Every packet has the same three-part shape, and each part exists for a specific reason. First, the header. The header carries the source I P address — where this came from — and the destination I P address, where it is going. Routers read that destination to decide where to send it next. The header also carries the sequence number, which is what lets the receiver put the pieces back in order. So the header answers two questions: where is this going, and where does it belong in the sequence." },

    { focus:"payload", cap:"The payload: the only part you actually wanted.",
      text:"Second, the payload. This is the actual data — a slice of the page, the image, the video frame. This is the only part you actually wanted. Everything else in the packet is addressing and administration, which is the price of being able to route each piece independently." },

    { focus:"footer", cap:"The footer: did this arrive intact?",
      text:"Third, the footer, which some books call the trailer. It marks the end of the packet and carries error-checking information. The receiver runs a calculation over the data it received and compares it to what the footer says it should be. If they do not match, the packet was corrupted somewhere in transit, and it gets thrown away and sent again." },

    { focus:"reliab", cap:"Reliability is not packets never failing.",
      text:"Which brings us to the part people get wrong. Packets get lost. Routinely. Routers under load drop them, links go down, things get corrupted. This is normal, not exceptional. So where does reliability come from? Not from packets being perfect — they are not. It comes from the receiver being able to notice. Say five packets were sent and you have one, two, four and five. You know three is missing, and you know it without anyone telling you, because the sequence numbers have a gap in them. So packet three is sent again. Just that one. The other four are already safely here and nobody resends them. That is the whole trick: detection plus targeted retransmission. The system does not try to prevent loss. It just makes loss cheap to recover from. One note for later: the numbering and the resending are the job of a protocol called T C P, which works alongside I P. I P only does the addressing. You will meet T C P and I P together in the protocols homework." }
  ],

  /* -------------------------------------------------------- SECTION 3: IPv4 */
  "sec-3": [
    { focus:"unique", cap:"Every device needs one, and it has to be unique.",
      text:"We have said packets carry a destination I P address. So let us look at what one of those actually is. Every device connected to the internet needs an address, and it has to be unique, because if two machines had the same address the network would have no way to decide which one a packet was meant for. The version that has run the internet for decades is I P version four — I P v four." },

    { focus:"octets", cap:"Four numbers, each 0 to 255, each an 8-bit octet.",
      text:"An I P v four address is four numbers separated by full stops. Something like 192 dot 168 dot 0 dot 1. Each of those four numbers is called an octet, and each one can be anything from zero to 255. Now, that upper limit of 255 looks arbitrary until you see where it comes from. Octet means eight — each of those numbers is stored as eight bits. Four octets of eight bits each gives thirty two bits for the whole address." },

    { focus:"binary", cap:"You already know this from Year 11.",
      text:"And here is where something you already know turns up somewhere useful. Eight bits, with place values of 128, 64, 32, 16, 8, 4, 2 and 1 — that is exactly the binary conversion you did in Year eleven. Take 192. Does 128 fit? Yes, so that column gets a one, and 64 is left over. Does 64 fit into 64? Yes, another one, and now nothing is left. Every remaining column is zero. So 192 is one one zero zero zero zero zero zero. The same method works every time: go left to right, and take the biggest value that still fits. Going the other way, from binary back to decimal, is even quicker: add up the place values of every column that has a one. One one zero zero zero zero zero zero is 128 plus 64, which is 192. You will do a few of these yourself in a moment, in both directions." },

    { focus:"limit", cap:"255 isn't arbitrary. It's all eight bits set.",
      text:"That also explains the 255. If every one of the eight bits is set to one, you are adding 128 plus 64 plus 32 plus 16 plus 8 plus 4 plus 2 plus 1. That comes to 255. There is simply no room in eight bits for 256, which is why an address ending in 256 is not a valid address at all — it is not a rule somebody chose, it is arithmetic." },

    { focus:"ipv6", cap:"4.3 billion was not enough.",
      text:"Thirty two bits gives you about four point three billion possible addresses. In the nineteen eighties, when this was designed, four point three billion was an absurd, unreachable number. Then everybody got a phone. And a laptop. And a watch, a television, a doorbell, a car. The internet ran out of addresses. The fix is I P version six, which uses one hundred and twenty eight bits instead of thirty two. That produces a number of addresses so large that running out is no longer a practical concern — which is the entire reason it exists." }
  ],

  /* ----------------------------------------------------------- SECTION 4: DNS */
  "sec-4": [
    { focus:"you", cap:"A packet needs a number. A person remembers a name.",
      text:"Every packet you send has to carry a destination I P address. Not a name — an address, like 142.250.70.206. But nobody types that. You type a name, because names are what people can remember. So something has to sit in the middle and turn one into the other. That something is D N S, the Domain Name System." },

    { focus:"res", cap:"The resolver does the looking on your behalf.",
      text:"You might expect that to be one question and one answer. Ask a server, get an address back. But there is no single machine anywhere that holds every domain name on earth. So instead of one enormous list, D N S is built as a hierarchy. Your request walks down it, asking a more specific question at each level. The machine that does that walking on your behalf is called the resolver — usually run by your internet provider. Think of it as an assistant you hand the name to." },

    { focus:"cache", cap:"First question the resolver asks: do I already know this?",
      text:"Before the resolver goes anywhere, it checks its own memory — its cache. Has anybody asked for this same domain recently? If yes, and the answer has not gone stale, it hands the address straight back and nothing else in this process happens at all. Hold on to that. It comes back at the end, and it explains something you have noticed without ever thinking about it." },

    { focus:"root", cap:"Root doesn't know the address. It knows who handles .com.",
      text:"Say it is not in the cache. The resolver starts at the top, with the root servers. Here is the part worth getting straight: the root servers do not know where example dot com is. That is not their job. What they know is who is responsible for everything ending in dot com. So they answer a narrower question than the one you asked. It is like asking for someone's street address by starting with, who handles this city? You are not expecting the address yet. You are expecting to be pointed one level closer." },

    { focus:"tld", cap:"The .com server knows who is authoritative — not the address.",
      text:"Root points the resolver at the dot com server — the top level domain server, or T L D. And the same thing happens again. The dot com server still does not know the address. What it knows is which name server is authoritative for example dot com. Authoritative is the key word: it means that server is the one holding the real, current record — the source of truth for that domain. So we have gone from, who handles dot com, to, who holds the truth about example dot com. Each step narrows." },

    { focus:"auth", cap:"The authoritative server has the real record. Answer, then cache.",
      text:"Now the resolver asks the authoritative server, and this time it gets the actual I P address. But before handing it back to your browser, it does one more thing — it writes the answer into its cache. And that is the piece from earlier. The next person who asks for that domain gets the answer immediately, skipping root, skipping T L D, skipping the authoritative server. That is why a site you visited a minute ago loads faster than one you have never opened. Finally, with the address in hand, your browser makes its real request, the server sends the page, and it loads." },

    { focus:"notdns", cap:"DNS does one job. Three others get confused with it.",
      text:"One last thing, because this is where marks get lost. D N S does one job: a name goes in, and an address comes out. Three other protocols often get mixed up with it. D H C P gives your device its own I P address when it joins a network, like the school wifi. H T T P is what actually fetches the page, once your browser has the address. And T L S encrypts the data as it travels, so it cannot be read if someone intercepts it. All three are real, and all three matter. None of them is D N S." }
  ]
};
