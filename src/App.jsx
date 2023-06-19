import {useEffect, useRef, useState} from 'react'
import { SignClient } from '@walletconnect/sign-client';
import { Web3Modal } from '@web3modal/standalone';
import './App.css'


// Your dapp's Project ID from https://cloud.walletconnect.com/
const WC_PROJECT_ID = 'cc3b2ecffec2ba45dfa80295a62b3f5a';
const CHAIN_ID = 'finschia-2';

// https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
const CAIP_BLOCKCHAIN_ID = `cosmos:${CHAIN_ID}`

const web3modal = new Web3Modal({
    walletConnectVersion: 2,
    projectId: WC_PROJECT_ID,
    standaloneChains: [CAIP_BLOCKCHAIN_ID]
});

function initSignClient() {
    const [uri, setUri] = useState('')
    const [address, setAddress] = useState(null);
    const [session, setSession] = useState(null);
    const signClient = useRef(null)

    useEffect(() => {
        (async () => {
            const result =  await SignClient.init({
                projectId: WC_PROJECT_ID,
                metadata: {
                    name: "WC2 dApp",
                    description: "WalletConnect v2 Dapp Example for DOSI Vault Extension",
                    url: "https://dapp.example.com",
                    icons: ["https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"],
                },
            })
            signClient.current = result
            signClient.current.on("session_delete", () => {
                window.location.reload();
            });
            const { uri, approval }  = await signClient.current.connect({});
            setUri(uri)
            const wcSession = await approval();
            web3modal.closeModal();
            setSession(wcSession);
            const bech32 = parseAccount(wcSession.namespaces.cosmos.accounts[0]).bech32;
            setAddress(bech32);
        })();
    }, [])

    return {
        uri,
        address,
        session,
        signClient: signClient.current
    }
}


function parseAccount(account) {
    // example `cosmos:finschia-beta-2:link1a509xf4stwa9yaec5vu64fcem5zeyc3t7t47fc`
    const parts = account.split(':');
    return {
        ns: parts[0],
        chainId: parts[1],
        bech32: parts[2]
    }
}

function App() {
    const [msgToSign, setMsgToSign] = useState('Any text');
    const [signature, setSignature] = useState(null);
    const [dynamicLinkBase, setDynamicLinkBase] = useState("https://dosivault.page.link/qL6j");

    const { uri, signClient, address, session } = initSignClient()

    async function showQRCodeModal() {
        web3modal.openModal({uri});
    }

    function getDynamicLinkUrl(wcUrl) {
        const encodedUrl = encodeURIComponent(wcUrl);
        return `${dynamicLinkBase}?uri_wc=${encodedUrl}`;
    }

    async function handleSignArbitraryMsg() {
        const resp = await signClient.request({
            chainId: CAIP_BLOCKCHAIN_ID,
            request: {
                method: "cosmos_sign_free_message",
                params: {
                    msg: msgToSign,
                    signerAddress: address
                }    
            },
            topic: session.topic
        });
        setSignature(resp.signature.signature);
    }

    return (
        <div className="App">
            <div>
                <img src="https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"></img>
            </div>
            <h1>dApp Example</h1>
            <h2>WalletConnect v2 + Vault</h2>
            <div>WC URI: {uri}</div>
            
            <div className="card">
                <div hidden={!!address}>
                    <div>
                        {
                            uri ? (
                                <button onClick={showQRCodeModal}>
                                    Connect (QR Modal)
                                </button>
                            ) : null
                        }
                    </div>
                    <div>
                        {
                            uri ? (<a href={getDynamicLinkUrl(uri)}>Dynamic link</a>) : null
                        }
                        
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
                        <a href={getDynamicLinkUrl(uri)}>
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
                    <a href='https://github.com/dosivault/wc_v2_example'>Source code</a>
                </h3>
                <div className='card'>
                    <label>Dynamic link base</label>
                    <input  type="url" value={dynamicLinkBase} onChange={ e=> setDynamicLinkBase(e.target.value) } />
                </div>
            </footer>
        </div>
    )
}

export default App
