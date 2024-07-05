import React, { useState, useEffect } from "react";
import Web3 from "web3";
import VotingContract from "./VotingContract";
import "./App.css";

const App = () => {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [proposals, setProposals] = useState({ Elon: "0", Mark: "0", Sam: "0" });
  const [owner, setOwner] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [balance, setBalance] = useState(0);
  const [remainingVotes, setRemainingVotes] = useState(0);
  const [history, setHistory] = useState([]);
  const [web3, setWeb3] = useState(null);
  const [isVotingActive, setIsVotingActive] = useState(true);
  const [winner, setWinner] = useState("");
  const [isDestroyed, setIsDestroyed] = useState(false);

  useEffect(() => {
    const loadWeb3 = async () => {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        await window.ethereum.enable();
        const accounts = await web3Instance.eth.getAccounts();
        setAccount(accounts[0]);
        setWeb3(web3Instance);
      }
    };

    const loadBlockchainData = async () => {
      const web3Instance = new Web3(window.ethereum);
      const contractAddress = "0xf7164EB02567456942102ced5090c21d88207B78";
      const abi = VotingContract.options.jsonInterface;
      const contractInstance = new web3Instance.eth.Contract(abi, contractAddress);
      setContract(contractInstance);

      const accounts = await web3Instance.eth.getAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];

        const proposalVotes = await Promise.all([
          contractInstance.methods.proposals("Elon").call(),
          contractInstance.methods.proposals("Mark").call(),
          contractInstance.methods.proposals("Sam").call(),
        ]);
        console.log("Proposal votes loaded:", proposalVotes);
        setProposals({
          Elon: proposalVotes[0].toString(),
          Mark: proposalVotes[1].toString(),
          Sam: proposalVotes[2].toString(),
        });

        const owner = await contractInstance.methods.owner().call();
        setOwner(owner);

        const isVotingActive = await contractInstance.methods.isVotingActive().call();
        setIsVotingActive(isVotingActive);

        const isDestroyed = await contractInstance.methods.isDestroyed().call();
        setIsDestroyed(isDestroyed);

        const balance = await web3Instance.eth.getBalance(contractAddress);
        setBalance(web3Instance.utils.fromWei(balance, "ether"));

        if (account) {
          const remainingVotes = await contractInstance.methods.getRemainingVotes(account).call();
          console.log(remainingVotes, "here");
          setRemainingVotes(remainingVotes);
        }

        const voteEvents = await contractInstance.getPastEvents("Voted", {
          fromBlock: 0,
          toBlock: "latest",
        });
        setHistory(voteEvents.map((event) => event.returnValues));
      } else {
        console.error("No accounts found");
      }
    };

    loadWeb3();
    loadBlockchainData();
  }, [account]);

  useEffect(() => {
    const handleAccountsChanged = async (accounts) => {
      setAccount(accounts[0]);
      if (contract) {
        const remainingVotes = await contract.methods.getRemainingVotes(accounts[0]).call();
        setRemainingVotes(remainingVotes);
      }
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [contract]);

  const vote = async (proposal) => {
    if (contract && web3 && !isDestroyed) {
      setIsVotingActive(false);
      await contract.methods.vote(proposal).send({
        from: account,
        value: web3.utils.toWei("0.01", "ether"),
      });
      const votes = await contract.methods.proposals(proposal).call();
      console.log(`Votes for ${proposal}:`, votes.toString());
      setProposals({ ...proposals, [proposal]: votes.toString() });

      const balance = await web3.eth.getBalance(contract.options.address);
      setBalance(web3.utils.fromWei(balance, "ether"));

      const voteEvents = await contract.getPastEvents("Voted", {
        fromBlock: 0,
        toBlock: "latest",
      });
      setHistory(voteEvents.map((event) => event.returnValues));

      const remainingVotes = await contract.methods.getRemainingVotes(account).call();
      setRemainingVotes(remainingVotes);

      setIsVotingActive(true);
    } else {
      console.error("Contract or web3 is not loaded yet.");
    }
  };

  const endVoting = async () => {
    if (contract && !isDestroyed) {
      await contract.methods.endVoting().send({ from: account });
      setIsVotingActive(false);
    }
  };

  const withdraw = async () => {
    if (contract && web3 && !isDestroyed) {
      await contract.methods.withdraw().send({ from: account });
      const balance = await web3.eth.getBalance(contract.options.address);
      setBalance(web3.utils.fromWei(balance, "ether"));
    }
  };

  const declareWinner = async () => {
    if (contract && !isDestroyed) {
      await contract.methods.declareWinner().send({ from: account });
      const winner = await contract.methods.winnerProposal().call();
      setWinner(winner);
    }
  };

  const resetVoting = async () => {
    if (contract && !isDestroyed) {
      await contract.methods.resetVoting().send({ from: account });
      setWinner(""); // Reset winner state

      // Reset the proposals in the frontend
      setProposals({ Elon: "0", Mark: "0", Sam: "0" });

      // Reload the remaining votes for the current user
      const remainingVotes = await contract.methods.getRemainingVotes(account).call();
      setRemainingVotes(remainingVotes);

      // Clear the history
      setHistory([]);
    }
  };

  const changeOwner = async () => {
    if (contract && newOwner && web3.utils.isAddress(newOwner) && !isDestroyed) {
      await contract.methods.changeOwner(newOwner).send({ from: account });
      setOwner(newOwner);
      setNewOwner("");
    } else {
      console.error("Invalid new owner address");
    }
  };

  const destroy = async () => {
    if (contract && !isDestroyed) {
      await contract.methods.destroy().send({ from: account });
      setIsDestroyed(true);
    }
  };

  const isOwner = account.toLowerCase() === owner.toLowerCase();

  return (
    <div className="container">
      <h2>Scrum Voting DApp</h2>
      {isDestroyed ? (
        <div>
          <h3>The contract was destroyed.</h3>
        </div>
      ) : (
        <div>
          <div className="proposals">
            {Object.keys(proposals).map((proposal) => (
              <div className={`proposal-card ${winner === proposal ? "winner" : ""}`} key={proposal}>
                <img src={`/${proposal.toLowerCase()}.png`} alt={proposal} />
                <h3>{proposal}</h3>
                <p>Votes: {proposals[proposal]}</p>
                <button onClick={() => vote(proposal)} disabled={!isVotingActive || isOwner}>
                  Vote
                </button>
              </div>
            ))}
          </div>
          <div className="owner-section">
            <div>
              <label>Owner's Address</label>
              <input value={owner} readOnly />
            </div>
            <div>
              <label>Current Address</label>
              <input value={account} readOnly />
            </div>
            {!isOwner && <p>Remaining Votes: {remainingVotes.toString()}</p>}
            <p>The balance is: {balance} ETH</p>
            <div className="button-container">
              <div className="button-group">
                <button onClick={withdraw} disabled={!isOwner}>
                  Withdraw
                </button>
                <button onClick={declareWinner} disabled={!isOwner || isVotingActive}>
                  Declare Winner
                </button>
                <button onClick={resetVoting} disabled={!isOwner || isVotingActive}>
                  Reset
                </button>
              </div>
              <div className="input-group">
                <input type="text" placeholder="Enter new owner's wallet address" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
                <button onClick={changeOwner} disabled={!isOwner}>
                  Change Owner
                </button>
              </div>
              <div className="button-group">
                <button onClick={destroy} disabled={!isOwner}>
                  Destroy
                </button>
              </div>
              <div className="button-group">
                <button onClick={endVoting} disabled={!isOwner || !isVotingActive}>
                  End Voting
                </button>
              </div>
            </div>
          </div>
          <div className="history">
            <h3>History</h3>
            <ul>
              {history.map((event, index) => (
                <li key={index}>
                  {event.proposal}, {event.votes}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
