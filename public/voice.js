// =========================================================
// Kurukshetra voice — mesh WebRTC with team-aware muting
// =========================================================
// One RTCPeerConnection per remote player. The "polite peer" is whichever
// has the lexicographically smaller socketId; collisions are handled with
// the well-known polite/impolite pattern from Jan-Ivar Bruaroey.
//
// Audio gating:
//   - During SETUP   : only same-team peers' audio is unmuted on receive.
//   - During BREAK   : every peer's audio is unmuted (open battlefield comms).
//   - During LOBBY / round_over / match_over : team-only.

(function () {
  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const peers = new Map();   // peerId -> { pc, audioEl, polite, makingOffer, ignoreOffer }
  let localStream = null;
  let micEnabled = false;
  let micMuted = false;
  let socketRef = null;
  let mySocketId = null;
  let lastSnap = null;

  // attached to window so client.js can talk to us
  window.Voice = {
    init,
    enableMic,
    disableMic,
    toggleMute,
    onSnapshot,
    isEnabled: () => micEnabled,
    isMuted: () => micMuted
  };

  function init(socket, ourId) {
    socketRef = socket;
    mySocketId = ourId;

    socket.on('voice-signal', async ({ from, payload }) => {
      const peer = ensurePeer(from);
      try {
        if (payload.sdp) {
          const desc = payload.sdp;
          const offerCollision = desc.type === 'offer' &&
            (peer.makingOffer || peer.pc.signalingState !== 'stable');
          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;
          await peer.pc.setRemoteDescription(desc);
          if (desc.type === 'offer') {
            await peer.pc.setLocalDescription();
            socketRef.emit('voice-signal', { to: from, payload: { sdp: peer.pc.localDescription } });
          }
        } else if (payload.candidate) {
          try {
            await peer.pc.addIceCandidate(payload.candidate);
          } catch (e) { if (!peer.ignoreOffer) console.warn('ICE add failed', e); }
        }
      } catch (e) {
        console.warn('voice-signal error', e);
      }
    });

    socket.on('voice-peer-left', ({ peerId }) => {
      const peer = peers.get(peerId);
      if (!peer) return;
      try { peer.pc.close(); } catch (_) {}
      if (peer.audioEl) peer.audioEl.remove();
      peers.delete(peerId);
    });
  }

  async function enableMic() {
    if (micEnabled) return true;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      micEnabled = true;
      micMuted = false;
      announceState();
      // attach local track to all existing peers
      for (const [peerId, peer] of peers) {
        for (const track of localStream.getAudioTracks()) {
          peer.pc.addTrack(track, localStream);
        }
      }
      // and connect to all current players if we have a snapshot
      if (lastSnap) connectToAllPeers(lastSnap);
      return true;
    } catch (e) {
      console.warn('Microphone permission denied or unavailable', e);
      micEnabled = false;
      return false;
    }
  }

  function disableMic() {
    if (!micEnabled) return;
    micEnabled = false;
    micMuted = false;
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    // tear down all peers
    for (const [peerId, peer] of peers) {
      try { peer.pc.close(); } catch (_) {}
      if (peer.audioEl) peer.audioEl.remove();
    }
    peers.clear();
    announceState();
  }

  function toggleMute() {
    if (!localStream) return;
    micMuted = !micMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
    announceState();
  }

  function announceState() {
    if (!socketRef) return;
    socketRef.emit('voice-state', { enabled: micEnabled, muted: micMuted });
    if (window.onVoiceStateChange) window.onVoiceStateChange();
  }

  function ensurePeer(peerId) {
    if (peers.has(peerId)) return peers.get(peerId);
    const polite = mySocketId < peerId;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const peer = { pc, audioEl: null, polite, makingOffer: false, ignoreOffer: false };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.emit('voice-signal', { to: peerId, payload: { candidate } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        socketRef.emit('voice-signal', { to: peerId, payload: { sdp: pc.localDescription } });
      } catch (e) {
        console.warn('negotiation error', e);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = ({ track, streams }) => {
      if (!peer.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.dataset.peer = peerId;
        document.body.appendChild(audio);
        peer.audioEl = audio;
      }
      peer.audioEl.srcObject = streams[0];
      applyTeamMutingForPeer(peerId);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        try { pc.close(); } catch (_) {}
        if (peer.audioEl) peer.audioEl.remove();
        peers.delete(peerId);
      }
    };

    // attach our local mic if we already have one
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }
    }
    peers.set(peerId, peer);
    return peer;
  }

  function connectToAllPeers(snap) {
    if (!micEnabled) return;
    for (const p of snap.players) {
      if (p.socketId === mySocketId) continue;
      ensurePeer(p.socketId);
    }
    // remove stale peers (player left)
    const live = new Set(snap.players.map(p => p.socketId));
    for (const peerId of [...peers.keys()]) {
      if (!live.has(peerId)) {
        const peer = peers.get(peerId);
        try { peer.pc.close(); } catch (_) {}
        if (peer.audioEl) peer.audioEl.remove();
        peers.delete(peerId);
      }
    }
  }

  function isCrossTeamOpen(snap) {
    // open battlefield comms only during BREAK (combat)
    return snap.phase === 'break';
  }

  function applyTeamMuting(snap) {
    for (const peerId of peers.keys()) applyTeamMutingForPeer(peerId, snap);
  }
  function applyTeamMutingForPeer(peerId, snap = lastSnap) {
    const peer = peers.get(peerId);
    if (!peer || !peer.audioEl || !snap) return;
    const me = snap.players.find(p => p.socketId === mySocketId);
    const other = snap.players.find(p => p.socketId === peerId);
    if (!me || !other) return;
    const sameTeam = me.team && other.team && me.team === other.team;
    const open = isCrossTeamOpen(snap);
    peer.audioEl.muted = !(sameTeam || open);
  }

  function onSnapshot(snap) {
    lastSnap = snap;
    if (micEnabled) connectToAllPeers(snap);
    applyTeamMuting(snap);
  }
})();
