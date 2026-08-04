/**
 * Detección de red local (Wi-Fi del restaurante).
 *
 * En un navegador no es posible leer la IP del dispositivo directamente por
 * seguridad. Se combinan dos técnicas:
 *  1. WebRTC ICE gathering: obtiene la IP local del candidato ICE.
 *  2. Sondeo del agente de impresión local: el endpoint sólo responde dentro
 *     de la LAN del restaurante.
 *
 * El bloqueo real (4G/5G fuera del local) se aplica cuando enforcement='strict'.
 * En 'demo' se muestra un aviso pero se permite trabajar (útil para previsualizar
 * la app fuera del local). El administrador puede cambiar el modo desde Ajustes.
 */

export interface NetworkState {
  onLan: boolean;
  localIp: string | null;
  checked: boolean;
  reason: string;
}

const RTCPeerConnectionCtor: typeof RTCPeerConnection | undefined =
  (window as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }).RTCPeerConnection ||
  (window as unknown as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection;

async function detectLocalIp(prefix: string): Promise<string | null> {
  if (!RTCPeerConnectionCtor) return null;
  try {
    const pc = new RTCPeerConnectionCtor({ iceServers: [] });
    pc.createDataChannel('');
    const ips: string[] = await new Promise((resolve) => {
      const found: string[] = [];
      const timer = setTimeout(() => resolve(found), 1200);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timer);
          resolve(found);
          return;
        }
        const m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
        if (m && !found.includes(m[1])) found.push(m[1]);
      };
    });
    pc.close();
    const match = ips.find((ip) => ip.startsWith(prefix));
    return match ?? ips.find((ip) => !ip.startsWith('169.254')) ?? null;
  } catch {
    return null;
  }
}

async function probeLanAgent(agentUrl: string): Promise<boolean> {
  if (!agentUrl) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    await fetch(`${agentUrl.replace(/\/$/, '')}/health`, {
      signal: ctrl.signal,
      mode: 'no-cors',
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export async function checkNetwork(
  prefix: string,
  agentUrl: string,
): Promise<NetworkState> {
  const [ip, agent] = await Promise.all([
    detectLocalIp(prefix),
    probeLanAgent(agentUrl),
  ]);

  if (ip && ip.startsWith(prefix)) {
    return { onLan: true, localIp: ip, checked: true, reason: `IP local ${ip}` };
  }
  if (agent) {
    return { onLan: true, localIp: ip, checked: true, reason: 'Agente de impresión alcanzable' };
  }
  if (ip && !ip.startsWith(prefix)) {
    return {
      onLan: false,
      localIp: ip,
      checked: true,
      reason: `IP ${ip} fuera del rango ${prefix}X`,
    };
  }
  return {
    onLan: false,
    localIp: null,
    checked: true,
    reason: 'No se detectó red local del restaurante',
  };
}
