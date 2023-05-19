import {useEffect, useState} from 'react'
import { SignClient } from '@walletconnect/sign-client';
import { Web3Modal } from '@web3modal/standalone';
import './App.css'


// Your dapp's Project ID from https://cloud.walletconnect.com/
const WC_PROJECT_ID = '9e1152b9dc0318eea105dc31238fbc00';
// CAUTION) it'll be changed to `finschia-2` around the end of May 2023
const CHAIN_ID = 'finschia-1';
// https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
const CAIP_BLOCKCHAIN_ID = `cosmos:${CHAIN_ID}`
const signClient = await SignClient.init({
    projectId: WC_PROJECT_ID,
    metadata: {
        name: "WC2 dApp",
        description: "WalletConnect v2 Dapp Example for DOSI Vault Extension",
        url: "https://dapp.example.com",
        icons: ["https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"],
    },
});
const connection = await signClient.connect({});

function parseAccount(account) {
    // example `cosmos:finschia-beta-2:link1a509xf4stwa9yaec5vu64fcem5zeyc3t7t47fc`
    const parts = account.split(':');
    return {
        ns: parts[0],
        chainId: parts[1],
        bech32: parts[2]
    }
}

async function initSignClient() {
    
}

function App() {
    const [wcUri, setWcUri] = useState(null);
    const [address, setAddress] = useState(null);
    const [session, setSession] = useState(null);
    const [msgToSign, setMsgToSign] = useState('Any text');
    const [signature, setSignature] = useState(null);
    const [dynamicLinkBase, setDynamicLinkBase] = useState("https://dosivault.page.link/qL6j");
    
    useEffect(() => {
        // componentDidMount()
        console.log('like componentDidMount()');
    
        console.log('signClient', signClient);

        signClient.on("disconnect", (error, payload) => {
            console.log('on "disconnect"');
            setWcUri(null);
            setAddress(null);
        });
        setWcUri(connection.uri);
    
        return () => {    // clean up (componetWillUnmount)
            console.log('like componentWillUnmount()');
            signClient.removeAllListeners("connect");
            signClient.removeAllListeners("disconnect");
        };
    }, []);
    
    async function showQRCodeModal() {
        console.log('waiting approval() to be completed');
        const web3modal = new Web3Modal({
            walletConnectVersion: 2,
            projectId: WC_PROJECT_ID,
            standaloneChains: [CAIP_BLOCKCHAIN_ID]
        });
        await web3modal.openModal({
            uri: connection.uri
        });
        const ses = await connection.approval();
        console.log('session approved', ses);
        setSession(ses);
        web3modal.closeModal();
        // address from 'cosmos' namespace account
        const bech32 = parseAccount(ses.namespaces.cosmos.accounts[0]).bech32;
        setAddress(bech32);
    }

    function getDynamicLinkUrl(wcUrl) {
        if(!!wcUrl) {
            const encodedUrl = encodeURIComponent(wcUrl);
            return `${dynamicLinkBase}?uri_wc=${encodedUrl}`;
        } else {
            return dynamicLinkBase;
        }
    }

    async function handleSignArbitraryMsg() {
        const [resp] = await signClient.request({
            // chainId: CAIP_BLOCKCHAIN_ID,
            chainId: `finschia:${CHAIN_ID}`,
            request: {
                method: "cosmos_sign_free_message",
                params: {
                    msg: msgToSign,
                    signerAddress: address
                }    
            },
            topic: session.topic
        });
        setSignature(resp.signature);
    }

    return (
        <div className="App">
            <div>
                <img src="https://i.pinimg.com/600x315/93/3e/14/933e14abb0241584fd6d5a31bea1ce7b.jpg"></img>
            </div>
            <h1>dApp Example</h1>
            <h2>WalletConnect v2 + Vault</h2>
            <div>WC URI: {wcUri}</div>
            
            <div className="card">
                <div hidden={!!address}>
                    <div>
                        <button onClick={showQRCodeModal}>
                            Connect (QR Modal)
                        </button>
                    </div>
                    <div>
                        <a href={getDynamicLinkUrl(connection.uri)}>Dynamic link</a>
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
