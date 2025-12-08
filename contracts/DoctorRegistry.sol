pragma solidity ^0.8.0;

contract DoctorRegistry {
    struct Doctor {
        address walletAddress;
        string fullName;
        uint256 age;
        string specialization;
        string department;
        string licenseId;
        bool exists;
        bool isActive;
        uint256 registeredDate;
        uint256 removedDate;
    }

    address public admin;
    mapping(address => Doctor) public doctors;
    address[] public doctorAddresses;

    event DoctorRegistered(address indexed wallet, string name, string department, uint256 timestamp);
    event DoctorRemoved(address indexed wallet, address indexed removedBy, uint256 timestamp);
    event DoctorReactivated(address indexed wallet, address indexed reactivatedBy, uint256 timestamp);

    constructor() { admin = msg.sender; }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    function registerDoctor(
        address wallet, string memory fullName, uint256 age,
        string memory specialization, string memory department, string memory licenseId
    ) external onlyAdmin {
        require(wallet != address(0) && !doctors[wallet].exists, "Invalid or exists");
        require(bytes(fullName).length > 0 && bytes(licenseId).length > 0, "Required fields");
        doctors[wallet] = Doctor(wallet, fullName, age, specialization, department, licenseId, true, true, block.timestamp, 0);
        doctorAddresses.push(wallet);
        emit DoctorRegistered(wallet, fullName, department, block.timestamp);
    }

    function removeDoctor(address wallet) external onlyAdmin {
        require(doctors[wallet].exists && doctors[wallet].isActive, "Not found or inactive");
        doctors[wallet].isActive = false;
        doctors[wallet].removedDate = block.timestamp;
        emit DoctorRemoved(wallet, msg.sender, block.timestamp);
    }

    function reactivateDoctor(address wallet) external onlyAdmin {
        require(doctors[wallet].exists && !doctors[wallet].isActive, "Not found or active");
        doctors[wallet].isActive = true;
        doctors[wallet].removedDate = 0;
        emit DoctorReactivated(wallet, msg.sender, block.timestamp);
    }

    function permanentlyRemoveDoctor(address wallet) external onlyAdmin {
        require(doctors[wallet].exists, "Not found");
        doctors[wallet].exists = false;
        for (uint256 i = 0; i < doctorAddresses.length; i++) {
            if (doctorAddresses[i] == wallet) {
                doctorAddresses[i] = doctorAddresses[doctorAddresses.length - 1];
                doctorAddresses.pop();
                break;
            }
        }
        emit DoctorRemoved(wallet, msg.sender, block.timestamp);
    }

    function isDoctor(address addr) external view returns (bool) {
        return doctors[addr].exists && doctors[addr].isActive;
    }

    function isAdmin(address addr) external view returns (bool) {
        return addr == admin;
    }

    function getDoctorByAddress(address addr) external view returns (
        address, string memory, uint256, string memory, string memory, string memory
    ) {
        require(doctors[addr].exists, "Not found");
        Doctor memory d = doctors[addr];
        return (d.walletAddress, d.fullName, d.age, d.specialization, d.department, d.licenseId);
    }

    function getDoctorInfoSafe(address addr) external view returns (
        bool, string memory, string memory, string memory, bool, uint256
    ) {
        Doctor memory d = doctors[addr];
        return (d.exists, d.fullName, d.specialization, d.department, d.isActive, d.removedDate);
    }

    function getAllDoctors() external view returns (Doctor[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < doctorAddresses.length; i++) {
            if (doctors[doctorAddresses[i]].isActive) count++;
        }
        Doctor[] memory result = new Doctor[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < doctorAddresses.length; i++) {
            if (doctors[doctorAddresses[i]].isActive) {
                result[idx++] = doctors[doctorAddresses[i]];
            }
        }
        return result;
    }

    function getAllDepartments() external view returns (string[] memory) {
        string[] memory temp = new string[](doctorAddresses.length);
        uint256 count = 0;
        for (uint256 i = 0; i < doctorAddresses.length; i++) {
            if (!doctors[doctorAddresses[i]].isActive) continue;
            string memory dept = doctors[doctorAddresses[i]].department;
            bool found = false;
            for (uint256 j = 0; j < count; j++) {
                if (keccak256(bytes(temp[j])) == keccak256(bytes(dept))) { found = true; break; }
            }
            if (!found) temp[count++] = dept;
        }
        string[] memory result = new string[](count);
        for (uint256 i = 0; i < count; i++) result[i] = temp[i];
        return result;
    }

    function getAllDoctorsIncludingInactive() external view onlyAdmin returns (Doctor[] memory) {
        Doctor[] memory result = new Doctor[](doctorAddresses.length);
        for (uint256 i = 0; i < doctorAddresses.length; i++) {
            result[i] = doctors[doctorAddresses[i]];
        }
        return result;
    }
}
