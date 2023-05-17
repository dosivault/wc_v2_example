import {useEffect, useState} from 'react'
import './App.css'
import WalletConnect from "@walletconnect/client";
import WalletConnectQRCodeModal from "@walletconnect/qrcode-modal";

const CHAIN_ID = "finschia-1";
let client = new WalletConnect({
    bridge: 'https://bridge.walletconnect.org',
    clientMeta: {
        name: "dApp example",
        description: "Just another dApp",
        url: "https://dapp.example/com",
        icons: ["https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"],
    },
});

function App() {
    const [sessionUri, setSessionUri] = useState(null);
    const [address, setAddress] = useState(null);
    const [msgToSign, setMsgToSign] = useState('Any text');
    const [signature, setSignature] = useState(null);
    const [dynamicLinkBase, setDynamicLinkBase] = useState("https://dosivault.page.link/qL6j");
    
    useEffect(() => {
        console.log('like componentDidMount()');
        // componentDidMount()
        client.on("connect", async (error, payload) => {
            if (error) {
                setSessionUri(null);
                throw error;
            }
            WalletConnectQRCodeModal.close();
            // no useful information in 'payload' since WalletConnect v1 is only for EVM-compatible chains
            // https://github.com/chainapsis/keplr-wallet/blob/master/packages/mobile/src/stores/wallet-connect/index.ts#L42
            console.log('on "connect"', payload, client.connected);
            const addrFromVault = await fetchAddress();
            setAddress(addrFromVault);
        });
    
        client.on("disconnect", (error, payload) => {
            console.log('on "disconnect"');
            setSessionUri(null);
            setAddress(null);
        });
    
        (async () => {
            // create a session on page load
            if(client.connected) {
                await client.killSession();
            }

            await client.createSession();
            setSessionUri(client.uri);    
        })();
        return () => {    // clean up (componetWillUnmount)
            console.log('like componentWillUnmount()');
            client.off("connect");
            client.off("disconnect");
        };
    }, []);
    
    async function showQRCodeModal() {
        console.log('connectWallet() clientid', client.clientId);
        WalletConnectQRCodeModal.open(client.uri);
    }

    function getDynamicLinkUrl(wcUrl) {
        if(!!wcUrl) {
            const encodedUrl = encodeURIComponent(wcUrl);
            return `${dynamicLinkBase}?uri_wc=${encodedUrl}`;
        } else {
            return dynamicLinkBase;
        }
    }

    async function fetchAddress() {
        // Keplr returns only an active address despite it's in a form of an array
        const accounts = await client.sendCustomRequest({
            id: Math.floor(Math.random() * 100000),
            method: "keplr_get_key_wallet_connect_v1",
            params: [CHAIN_ID],
        });
        console.log('fetched account:', accounts[0]);
        return accounts[0].bech32Address;
    }

    async function handleSignArbitraryMsg() {
        const [resp] = await client.sendCustomRequest({
            id: Math.floor(Math.random() * 100000),
            method: "keplr_sign_free_message_wallet_connect_v1",
            params: [CHAIN_ID, address, msgToSign],
        });
        setSignature(resp.signature);
    }

    return (
        <div className="App" style={{ backgroundColor: client.session.key ? 'white' : 'grey' }}>
            <div>
                <img src="https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"></img>
            </div>
            <h1>dApp Example</h1>
            <h2>WalletConnect v1 + Vault</h2>
            <div>Session URI: {sessionUri}</div>
            
            <div className="card">
                <div hidden={!!address}>
                    <div>
                        <button onClick={showQRCodeModal}>
                            Connect (QR Modal)
                        </button>
                    </div>
                    <div>
                        <a href={getDynamicLinkUrl(sessionUri)}>Dynamic link</a>
                    </div>
                </div>
                <div hidden={!address}>
                    Address: {address}

                    <div style={{borderBlock: "1px dotted"}}>
                        Message to sign :
                        <input value={msgToSign} onChange={e => setMsgToSign(e.target.value)}/>
                        <button onClick={handleSignArbitraryMsg}>
                            Off-chain sign
                        </button>
                        <a href={getDynamicLinkUrl()}>
                            Bring Vault to front
                        </a>
                        <div>
                            Signature: <p>{signature}</p>
                        </div>
                    </div>
                </div>
            </div>
            <footer>
                <h3>
                    <a href='https://github.com/dosivault/wc_v1_example'>Source code</a>
                </h3>
                <button onClick={() => { client.killSession() }}>Kill Session Manually (only for Debugging)</button>
                <div className='card'>
                    <label>Dynamic link base</label>
                    <input  type="url" value={dynamicLinkBase} onChange={ e=> setDynamicLinkBase(e.target.value) } />
                </div>
            </footer>
        </div>
    )
}

export default App
