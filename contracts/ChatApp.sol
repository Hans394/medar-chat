// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

contract ChatApp {
    // User data — hanya CID yang disimpan on-chain
    struct user {
        string profileCid;          // IPFS CID untuk profil (nama, publicKey, avatar)
        string friendListCid;       // IPFS CID untuk metadata daftar teman
        address[] friendAddresses;  // Daftar alamat teman (on-chain untuk validasi)
    }

    // Message — hanya CID yang disimpan on-chain
    struct message {
        address sender;
        uint256 timestamp;
        string msgCid;  // IPFS CID untuk konten pesan (terenkripsi)
    }

    // Struct untuk daftar semua user
    struct allUserStruck {
        string profileCid;
        address accountAddress;
    }

    allUserStruck[] getAllUsers;

    mapping(address => user) userList;
    mapping(bytes32 => message[]) allMessages;

    // ─── CHECK USER EXIST ────────────────────────────────────────────────────────
    function checkUserExist(address pubkey) public view returns (bool) {
        return bytes(userList[pubkey].profileCid).length > 0;
    }

    // ─── CREATE ACCOUNT ──────────────────────────────────────────────────────────
    function createAccount(string calldata profileCid) external {
        require(checkUserExist(msg.sender) == false, "User already exist");
        require(bytes(profileCid).length > 0, "Profile CID cannot be empty");

        userList[msg.sender].profileCid = profileCid;

        getAllUsers.push(allUserStruck(profileCid, msg.sender));
    }

    // ─── GET USER PROFILE CID ────────────────────────────────────────────────────
    function getUserProfileCid(address pubkey) external view returns (string memory) {
        require(checkUserExist(pubkey), "User is not registered");
        return userList[pubkey].profileCid;
    }

    // ─── UPDATE PROFILE CID ──────────────────────────────────────────────────────
    function updateProfileCid(string calldata newProfileCid) external {
        require(checkUserExist(msg.sender), "User is not registered");
        require(bytes(newProfileCid).length > 0, "Profile CID cannot be empty");

        userList[msg.sender].profileCid = newProfileCid;

        // Update di array getAllUsers juga
        for (uint256 i = 0; i < getAllUsers.length; i++) {
            if (getAllUsers[i].accountAddress == msg.sender) {
                getAllUsers[i].profileCid = newProfileCid;
                break;
            }
        }
    }

    // ─── ADD FRIEND ──────────────────────────────────────────────────────────────
    // Hanya menyimpan relasi alamat on-chain (untuk validasi)
    // Metadata teman (nama, dll) disimpan di IPFS via updateFriendListCid
    function addFriend(address friend_key) external {
        require(checkUserExist(msg.sender), "Create an account first");
        require(checkUserExist(friend_key), "User is not registered");
        require(
            msg.sender != friend_key,
            "User cannot add themselves as a friend"
        );
        require(
            checkAlreadyFriends(msg.sender, friend_key) == false,
            "These users are already friends"
        );

        // Tambahkan relasi dua arah
        userList[msg.sender].friendAddresses.push(friend_key);
        userList[friend_key].friendAddresses.push(msg.sender);
    }

    // ─── CHECK ALREADY FRIENDS ───────────────────────────────────────────────────
    function checkAlreadyFriends(
        address pubkey1,
        address pubkey2
    ) internal view returns (bool) {
        address shorter = pubkey1;
        address longer = pubkey2;
        if (userList[pubkey1].friendAddresses.length > userList[pubkey2].friendAddresses.length) {
            shorter = pubkey2;
            longer = pubkey1;
        }

        for (uint256 i = 0; i < userList[shorter].friendAddresses.length; i++) {
            if (userList[shorter].friendAddresses[i] == longer) return true;
        }
        return false;
    }

    // ─── GET MY FRIEND ADDRESSES ─────────────────────────────────────────────────
    function getMyFriendAddresses() external view returns (address[] memory) {
        return userList[msg.sender].friendAddresses;
    }

    // ─── UPDATE FRIEND LIST CID ──────────────────────────────────────────────────
    // Menyimpan CID IPFS dari metadata daftar teman (nama, avatar, dll)
    function updateFriendListCid(string calldata cid) external {
        require(checkUserExist(msg.sender), "Create an account first");
        userList[msg.sender].friendListCid = cid;
    }

    // ─── GET FRIEND LIST CID ─────────────────────────────────────────────────────
    function getFriendListCid() external view returns (string memory) {
        return userList[msg.sender].friendListCid;
    }

    // ─── GET CHAT CODE ───────────────────────────────────────────────────────────
    function _getChatCode(
        address pubkey1,
        address pubkey2
    ) internal pure returns (bytes32) {
        if (pubkey1 < pubkey2) {
            return keccak256(abi.encodePacked(pubkey1, pubkey2));
        } else return keccak256(abi.encodePacked(pubkey2, pubkey1));
    }

    // ─── SEND MESSAGE ────────────────────────────────────────────────────────────
    // msgCid = IPFS CID dari konten pesan (terenkripsi atau plaintext)
    function sendMessage(address friend_key, string calldata msgCid) external {
        require(checkUserExist(msg.sender), "Create an account first");
        require(checkUserExist(friend_key), "User is not registered");
        require(
            checkAlreadyFriends(msg.sender, friend_key),
            "You are not friend with the given user"
        );

        bytes32 chatCode = _getChatCode(msg.sender, friend_key);
        message memory newMsg = message(msg.sender, block.timestamp, msgCid);
        allMessages[chatCode].push(newMsg);
    }

    // ─── READ MESSAGE ────────────────────────────────────────────────────────────
    function readMessage(
        address friend_key
    ) external view returns (message[] memory) {
        bytes32 chatCode = _getChatCode(msg.sender, friend_key);
        return allMessages[chatCode];
    }

    // ─── DELETE FRIEND ───────────────────────────────────────────────────────────
    function deleteFriend(address friend_key) external {
        require(checkUserExist(msg.sender), "Create an account first");
        require(checkUserExist(friend_key), "User is not registered");
        require(checkAlreadyFriends(msg.sender, friend_key), "You are not friends with this user");

        // Remove from msg.sender's friendAddresses
        uint256 length = userList[msg.sender].friendAddresses.length;
        for (uint256 i = 0; i < length; i++) {
            if (userList[msg.sender].friendAddresses[i] == friend_key) {
                userList[msg.sender].friendAddresses[i] = userList[msg.sender].friendAddresses[length - 1];
                userList[msg.sender].friendAddresses.pop();
                break;
            }
        }

        // Remove from friend_key's friendAddresses
        uint256 friendLength = userList[friend_key].friendAddresses.length;
        for (uint256 i = 0; i < friendLength; i++) {
            if (userList[friend_key].friendAddresses[i] == msg.sender) {
                userList[friend_key].friendAddresses[i] = userList[friend_key].friendAddresses[friendLength - 1];
                userList[friend_key].friendAddresses.pop();
                break;
            }
        }
    }

    // ─── GET ALL APP USERS ───────────────────────────────────────────────────────
    function getAllAppUser() public view returns (allUserStruck[] memory) {
        return getAllUsers;
    }
}
