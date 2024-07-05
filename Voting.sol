// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    address public owner;
    address public constant secondOwner = 0x153dfef4355E823dCB0FCc76Efe942BefCa86477;
    uint public voteCost = 0.01 ether;
    uint public totalVotes;
    bool public isVotingActive = true;
    bool public isDestroyed = false; // Προσθήκη για να παρακολουθεί αν το συμβόλαιο έχει καταστραφεί
    mapping(address => uint) public votes;
    mapping(string => uint) public proposals;
    string[3] public proposalNames = ["Elon", "Mark", "Sam"];
    string public winnerProposal;

    event Voted(address indexed voter, string proposal, uint votes);
    event WinnerDeclared(string winner);
    event VotingReset();
    event VotingEnded();
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractDestroyed();

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyWhenVotingActive() {
        require(isVotingActive, "Voting is not active");
        _;
    }

    modifier notOwner() {
    require(msg.sender != owner && msg.sender != secondOwner, "Owner or secondOwner cannot vote");
    _;
}


    modifier contractActive() {
        require(!isDestroyed, "Contract is destroyed");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function vote(string memory proposal) public payable onlyWhenVotingActive notOwner contractActive {
        require(msg.value == voteCost, "Incorrect ether sent");
        require(votes[msg.sender] < 5, "Exceeded maximum votes");

        proposals[proposal] += 1;
        votes[msg.sender] += 1;
        totalVotes += 1;

        emit Voted(msg.sender, proposal, 1);
    }

    function endVoting() public onlyOwner contractActive {
        isVotingActive = false;
        emit VotingEnded();
    }

    function declareWinner() public onlyOwner contractActive {
        require(!isVotingActive, "Voting must be ended to declare a winner");

        string memory winner = proposalNames[0];
        uint maxVotes = proposals[winner];
        uint count = 1;

        for (uint i = 1; i < proposalNames.length; i++) {
            if (proposals[proposalNames[i]] > maxVotes) {
                winner = proposalNames[i];
                maxVotes = proposals[winner];
                count = 1;
            } else if (proposals[proposalNames[i]] == maxVotes) {
                count++;
            }
        }

        if (count > 1) {
            string[] memory topProposals = new string[](count);
            uint j = 0;
            for (uint i = 0; i < proposalNames.length; i++) {
                if (proposals[proposalNames[i]] == maxVotes) {
                    topProposals[j] = proposalNames[i];
                    j++;
                }
            }
            uint randomIndex = uint(keccak256(abi.encodePacked(block.timestamp, block.difficulty))) % count;
            winner = topProposals[randomIndex];
        }

        winnerProposal = winner;
        emit WinnerDeclared(winner);
    }

    function resetVoting() public onlyOwner contractActive {
        for (uint i = 0; i < proposalNames.length; i++) {
            proposals[proposalNames[i]] = 0;
        }
        totalVotes = 0;
        isVotingActive = true;
        winnerProposal = "";

        emit VotingReset();
    }

    function withdraw() public onlyOwner contractActive {
        payable(owner).transfer(address(this).balance);
    }

    function getRemainingVotes(address voter) public view contractActive returns (uint) {
        return 5 - votes[voter];
    }

    function changeOwner(address newOwner) public onlyOwner contractActive {
        require(newOwner != address(0), "Invalid new owner address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function destroy() public onlyOwner contractActive {
        isDestroyed = true;
        payable(owner).transfer(address(this).balance);
        emit ContractDestroyed();
    }
}
