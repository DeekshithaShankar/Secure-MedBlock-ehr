// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDoctorRegistry {
    function isDoctor(address addr) external view returns (bool);
}

contract HealthRecordSecure {
    struct Patient {
        uint256 patientId;
        address walletAddress;
        string fullName;
        uint256 age;
        string bloodGroup;
        string phone;
        address currentDoctor;
        bool exists;
        bool isActive;
    }

    struct Record {
        uint256 id;
        string description;
        string ipfsHash;
        string integrityHash;
        uint256 date;
        address addedBy;
        bool isEncrypted;
        string encryptionVersion;
    }

    struct DoctorAssignment {
        address doctor;
        uint256 assignedDate;
        uint256 transferredDate;
        string reason;
    }

    struct AccessLog {
        address accessor;
        uint256 timestamp;
        string accessType;
        string description;
        bool wasSuccessful;
    }

    struct Consent {
        address doctor;
        bool isGranted;
        uint256 grantedDate;
        uint256 revokedDate;
        uint256 expiryDate;
        string purpose;
    }

    struct ConsentRequest {
        address doctor;
        address patient;
        uint256 requestDate;
        string purpose;
        bool isPending;
        bool isApproved;
        bool isRejected;
    }

    address public admin;
    IDoctorRegistry public doctorRegistry;
    uint256 private nextPatientId = 1;

    mapping(address => Patient) public patients;
    mapping(uint256 => address) public patientIdToWallet;
    mapping(address => Record[]) private patientRecords;
    mapping(address => DoctorAssignment[]) private patientDoctorHistory;
    address[] public patientAddresses;
    mapping(address => AccessLog[]) private patientAccessLogs;
    mapping(address => mapping(address => Consent)) private patientConsents;
    mapping(address => address[]) private patientConsentedDoctors;
    mapping(address => mapping(address => ConsentRequest)) private consentRequests;
    mapping(address => address[]) private patientPendingRequests;
    mapping(address => mapping(address => bool)) private doctorPatientRelationship;
    mapping(address => address[]) private doctorPatientList;

    event PatientRegistered(uint256 indexed patientId, address indexed wallet, string name, address doctor);
    event RecordAdded(address indexed patient, uint256 recordId, address addedBy, string integrityHash);
    event PatientTransferred(address indexed patient, address indexed fromDoctor, address indexed toDoctor, string reason, uint256 timestamp);
    event PatientRemoved(address indexed patient, address indexed removedBy, uint256 timestamp);
    event RecordAccessed(address indexed patient, address indexed accessor, uint256 timestamp, string accessType);
    event ConsentGranted(address indexed patient, address indexed doctor, uint256 expiryDate, string purpose);
    event ConsentRevoked(address indexed patient, address indexed doctor, uint256 timestamp);
    event ConsentRequested(address indexed patient, address indexed doctor, string purpose, uint256 timestamp);
    event ConsentRequestApproved(address indexed patient, address indexed doctor, uint256 timestamp);
    event ConsentRequestRejected(address indexed patient, address indexed doctor, uint256 timestamp);
    event PatientAddedToDoctor(address indexed patient, address indexed doctor, uint256 timestamp);

    constructor(address registry) {
        require(registry != address(0), "Invalid registry");
        admin = msg.sender;
        doctorRegistry = IDoctorRegistry(registry);
    }

    modifier onlyDoctor() {
        require(doctorRegistry.isDoctor(msg.sender), "Not a doctor");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function registerPatient(
        address wallet, string memory fullName, uint256 age, string memory bloodGroup, string memory phone
    ) external onlyDoctor {
        require(wallet != address(0) && !patients[wallet].exists, "Invalid or exists");
        require(!doctorRegistry.isDoctor(wallet) && wallet != admin, "Cannot be doctor or admin");
        uint256 id = nextPatientId++;
        patients[wallet] = Patient(id, wallet, fullName, age, bloodGroup, phone, msg.sender, true, true);
        patientIdToWallet[id] = wallet;
        patientAddresses.push(wallet);
        patientDoctorHistory[wallet].push(DoctorAssignment(msg.sender, block.timestamp, 0, "Initial Registration"));
        _grantConsent(wallet, msg.sender, 0, "Primary Care Provider");
        doctorPatientRelationship[msg.sender][wallet] = true;
        doctorPatientList[msg.sender].push(wallet);
        _logAccess(wallet, msg.sender, "REGISTER", "Patient registered", true);
        emit PatientRegistered(id, wallet, fullName, msg.sender);
    }

    function addExistingPatientToMyList(address wallet) external onlyDoctor {
        require(patients[wallet].exists && patients[wallet].isActive, "Not found or inactive");
        require(!doctorPatientRelationship[msg.sender][wallet], "Already in list");
        doctorPatientRelationship[msg.sender][wallet] = true;
        doctorPatientList[msg.sender].push(wallet);
        patientDoctorHistory[wallet].push(DoctorAssignment(msg.sender, block.timestamp, 0, "Added for consultation"));
        _logAccess(wallet, msg.sender, "ADD_TO_LIST", "Added to doctor list", true);
        emit PatientAddedToDoctor(wallet, msg.sender, block.timestamp);
    }

    function searchAllPatients() external view onlyDoctor returns (address[] memory, string[] memory, bool[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            if (patients[patientAddresses[i]].isActive) count++;
        }
        address[] memory wallets = new address[](count);
        string[] memory names = new string[](count);
        bool[] memory inList = new bool[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            address addr = patientAddresses[i];
            if (patients[addr].isActive) {
                wallets[idx] = addr;
                names[idx] = patients[addr].fullName;
                inList[idx] = doctorPatientRelationship[msg.sender][addr] || patients[addr].currentDoctor == msg.sender;
                idx++;
            }
        }
        return (wallets, names, inList);
    }

    function isPatientInMyList(address wallet) external view returns (bool) {
        return doctorPatientRelationship[msg.sender][wallet] || patients[wallet].currentDoctor == msg.sender;
    }

    function addRecordSecure(
        address wallet, string memory description, string memory ipfsHash,
        string memory integrityHash, string memory encryptionVersion
    ) external onlyDoctor {
        require(patients[wallet].exists && patients[wallet].isActive, "Not found or inactive");
        require(bytes(ipfsHash).length > 0 && bytes(integrityHash).length > 0, "Invalid hashes");
        require(patients[wallet].currentDoctor == msg.sender || _hasValidConsent(wallet, msg.sender), "Not authorized");
        uint256 id = patientRecords[wallet].length + 1;
        patientRecords[wallet].push(Record(id, description, ipfsHash, integrityHash, block.timestamp, msg.sender, true, encryptionVersion));
        _logAccess(wallet, msg.sender, "ADD_RECORD", description, true);
        emit RecordAdded(wallet, id, msg.sender, integrityHash);
    }

    function _logAccess(address wallet, address accessor, string memory accessType, string memory description, bool success) internal {
        patientAccessLogs[wallet].push(AccessLog(accessor, block.timestamp, accessType, description, success));
        emit RecordAccessed(wallet, accessor, block.timestamp, accessType);
    }

    function getAccessLogs(address wallet) external view returns (AccessLog[] memory) {
        require(msg.sender == wallet || msg.sender == admin, "Access denied");
        return patientAccessLogs[wallet];
    }

    function getAccessLogCount(address wallet) external view returns (uint256) {
        require(msg.sender == wallet || msg.sender == admin, "Access denied");
        return patientAccessLogs[wallet].length;
    }

    function _hasValidConsent(address patient, address doctor) internal view returns (bool) {
        Consent memory c = patientConsents[patient][doctor];
        return c.isGranted && (c.expiryDate == 0 || c.expiryDate >= block.timestamp);
    }

    function _grantConsent(address patient, address doctor, uint256 expiry, string memory purpose) internal {
        if (!patientConsents[patient][doctor].isGranted) patientConsentedDoctors[patient].push(doctor);
        patientConsents[patient][doctor] = Consent(doctor, true, block.timestamp, 0, expiry, purpose);
    }

    function grantConsent(address doctor, uint256 expiry, string memory purpose) external {
        require(patients[msg.sender].exists && patients[msg.sender].isActive, "Not active patient");
        require(doctorRegistry.isDoctor(doctor) && doctor != patients[msg.sender].currentDoctor, "Invalid doctor");
        _grantConsent(msg.sender, doctor, expiry, purpose);
        _logAccess(msg.sender, msg.sender, "GRANT_CONSENT", string(abi.encodePacked("Granted: ", purpose)), true);
        emit ConsentGranted(msg.sender, doctor, expiry, purpose);
    }

    function revokeConsent(address doctor) external {
        require(patients[msg.sender].exists && patientConsents[msg.sender][doctor].isGranted, "Invalid");
        require(doctor != patients[msg.sender].currentDoctor, "Cannot revoke primary");
        patientConsents[msg.sender][doctor].isGranted = false;
        patientConsents[msg.sender][doctor].revokedDate = block.timestamp;
        _logAccess(msg.sender, msg.sender, "REVOKE_CONSENT", "Revoked access", true);
        emit ConsentRevoked(msg.sender, doctor, block.timestamp);
    }

    function hasConsent(address patient, address doctor) external view returns (bool) {
        return _hasValidConsent(patient, doctor);
    }

    function getConsentDetails(address patient, address doctor) external view returns (bool, uint256, uint256, uint256, string memory) {
        require(msg.sender == patient || msg.sender == doctor || msg.sender == admin, "Access denied");
        Consent memory c = patientConsents[patient][doctor];
        return (c.isGranted && (c.expiryDate == 0 || c.expiryDate > block.timestamp), c.grantedDate, c.revokedDate, c.expiryDate, c.purpose);
    }

    function getConsentedDoctors(address patient) external view returns (address[] memory, bool[] memory) {
        require(msg.sender == patient || msg.sender == admin, "Access denied");
        address[] storage all = patientConsentedDoctors[patient];
        address[] memory docs = new address[](all.length);
        bool[] memory active = new bool[](all.length);
        for (uint256 i = 0; i < all.length; i++) {
            docs[i] = all[i];
            active[i] = _hasValidConsent(patient, all[i]);
        }
        return (docs, active);
    }

    function requestConsent(address patient, string memory purpose) external onlyDoctor {
        require(patients[patient].exists && patients[patient].isActive, "Invalid patient");
        require(!_hasValidConsent(patient, msg.sender) && patients[patient].currentDoctor != msg.sender, "Already authorized");
        require(!consentRequests[patient][msg.sender].isPending, "Already pending");
        bool found = false;
        for (uint256 i = 0; i < patientPendingRequests[patient].length; i++) {
            if (patientPendingRequests[patient][i] == msg.sender) { found = true; break; }
        }
        if (!found) patientPendingRequests[patient].push(msg.sender);
        consentRequests[patient][msg.sender] = ConsentRequest(msg.sender, patient, block.timestamp, purpose, true, false, false);
        _logAccess(patient, msg.sender, "REQUEST_CONSENT", purpose, true);
        emit ConsentRequested(patient, msg.sender, purpose, block.timestamp);
    }

    function approveConsentRequest(address doctor, uint256 expiry) external {
        require(patients[msg.sender].exists && patients[msg.sender].isActive, "Not active patient");
        require(consentRequests[msg.sender][doctor].isPending, "No pending request");
        consentRequests[msg.sender][doctor].isPending = false;
        consentRequests[msg.sender][doctor].isApproved = true;
        string memory purpose = consentRequests[msg.sender][doctor].purpose;
        _grantConsent(msg.sender, doctor, expiry, purpose);
        _logAccess(msg.sender, msg.sender, "APPROVE_CONSENT", string(abi.encodePacked("Approved: ", purpose)), true);
        emit ConsentRequestApproved(msg.sender, doctor, block.timestamp);
    }

    function rejectConsentRequest(address doctor) external {
        require(patients[msg.sender].exists && consentRequests[msg.sender][doctor].isPending, "Invalid");
        consentRequests[msg.sender][doctor].isPending = false;
        consentRequests[msg.sender][doctor].isRejected = true;
        _logAccess(msg.sender, msg.sender, "REJECT_CONSENT", "Rejected request", true);
        emit ConsentRequestRejected(msg.sender, doctor, block.timestamp);
    }

    function getPendingConsentRequests(address patient) external view returns (ConsentRequest[] memory) {
        require(msg.sender == patient || msg.sender == admin, "Access denied");
        uint256 count = 0;
        for (uint256 i = 0; i < patientPendingRequests[patient].length; i++) {
            if (consentRequests[patient][patientPendingRequests[patient][i]].isPending) count++;
        }
        ConsentRequest[] memory result = new ConsentRequest[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientPendingRequests[patient].length; i++) {
            address doc = patientPendingRequests[patient][i];
            if (consentRequests[patient][doc].isPending) result[idx++] = consentRequests[patient][doc];
        }
        return result;
    }

    function hasPendingRequest(address patient, address doctor) external view returns (bool) {
        return consentRequests[patient][doctor].isPending;
    }

    function transferPatient(address wallet, address newDoctor, string memory reason) external onlyDoctor {
        require(patients[wallet].exists && patients[wallet].isActive, "Invalid patient");
        require(patients[wallet].currentDoctor == msg.sender, "Not assigned doctor");
        require(doctorRegistry.isDoctor(newDoctor) && newDoctor != msg.sender, "Invalid transfer");
        DoctorAssignment[] storage history = patientDoctorHistory[wallet];
        if (history.length > 0) history[history.length - 1].transferredDate = block.timestamp;
        history.push(DoctorAssignment(newDoctor, block.timestamp, 0, reason));
        address oldDoc = patients[wallet].currentDoctor;
        patients[wallet].currentDoctor = newDoctor;
        _grantConsent(wallet, newDoctor, 0, "Primary Care Provider");
        _logAccess(wallet, msg.sender, "TRANSFER", string(abi.encodePacked("Transferred: ", reason)), true);
        emit PatientTransferred(wallet, oldDoc, newDoctor, reason, block.timestamp);
    }

    function removePatient(address wallet) external onlyDoctor {
        require(patients[wallet].exists && patients[wallet].isActive, "Invalid patient");
        require(patients[wallet].currentDoctor == msg.sender, "Not assigned doctor");
        patients[wallet].isActive = false;
        DoctorAssignment[] storage history = patientDoctorHistory[wallet];
        if (history.length > 0) history[history.length - 1].transferredDate = block.timestamp;
        _logAccess(wallet, msg.sender, "REMOVE", "Deactivated", true);
        emit PatientRemoved(wallet, msg.sender, block.timestamp);
    }

    function reactivatePatient(address wallet, address doctor) external {
        require(patients[wallet].exists && !patients[wallet].isActive, "Invalid state");
        require(msg.sender == admin || patients[wallet].currentDoctor == msg.sender, "Not authorized");
        require(doctorRegistry.isDoctor(doctor), "Invalid doctor");
        patients[wallet].isActive = true;
        patients[wallet].currentDoctor = doctor;
        patientDoctorHistory[wallet].push(DoctorAssignment(doctor, block.timestamp, 0, msg.sender == admin ? "Admin reactivated" : "Doctor reactivated"));
        _logAccess(wallet, msg.sender, "REACTIVATE", "Reactivated", true);
    }

    function getPatientRecords(address patient) public view returns (Record[] memory) {
        require(patients[patient].exists, "Not found");
        require(msg.sender == patient || doctorRegistry.isDoctor(msg.sender) || msg.sender == admin, "Access denied");
        return patientRecords[patient];
    }

    function getPatientRecordsWithLogging(address patient) external returns (Record[] memory) {
        require(patients[patient].exists, "Not found");
        require(msg.sender == patient || doctorRegistry.isDoctor(msg.sender) || msg.sender == admin || _hasValidConsent(patient, msg.sender), "Access denied");
        _logAccess(patient, msg.sender, "VIEW_RECORDS", "Viewed records", true);
        return patientRecords[patient];
    }

    function getPatientDoctorHistory(address wallet) external view returns (DoctorAssignment[] memory) {
        require(patients[wallet].exists, "Not found");
        require(msg.sender == wallet || doctorRegistry.isDoctor(msg.sender) || msg.sender == admin, "Access denied");
        return patientDoctorHistory[wallet];
    }

    function isPatient(address addr) external view returns (bool) {
        return patients[addr].exists && patients[addr].isActive;
    }

    function getPatient(address addr) external view returns (string memory, uint256, string memory, string memory, address) {
        require(patients[addr].exists, "Not found");
        Patient memory p = patients[addr];
        return (p.fullName, p.age, p.bloodGroup, p.phone, p.currentDoctor);
    }

    function getPatientDetails(address addr) external view returns (uint256, string memory, uint256, string memory, string memory, address, bool) {
        require(patients[addr].exists, "Not found");
        Patient memory p = patients[addr];
        return (p.patientId, p.fullName, p.age, p.bloodGroup, p.phone, p.currentDoctor, p.isActive);
    }

    function getNextPatientId() external view returns (uint256) { return nextPatientId; }

    function getMyPatients() external view returns (Patient[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            address addr = patientAddresses[i];
            if (patients[addr].isActive && (patients[addr].currentDoctor == msg.sender || doctorPatientRelationship[msg.sender][addr])) count++;
        }
        Patient[] memory result = new Patient[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            address addr = patientAddresses[i];
            if (patients[addr].isActive && (patients[addr].currentDoctor == msg.sender || doctorPatientRelationship[msg.sender][addr])) result[idx++] = patients[addr];
        }
        return result;
    }

    function getAllPatientsHistory() external view returns (Patient[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            DoctorAssignment[] storage h = patientDoctorHistory[patientAddresses[i]];
            for (uint256 j = 0; j < h.length; j++) {
                if (h[j].doctor == msg.sender) { count++; break; }
            }
        }
        Patient[] memory result = new Patient[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < patientAddresses.length; i++) {
            DoctorAssignment[] storage h = patientDoctorHistory[patientAddresses[i]];
            for (uint256 j = 0; j < h.length; j++) {
                if (h[j].doctor == msg.sender) { result[idx++] = patients[patientAddresses[i]]; break; }
            }
        }
        return result;
    }

    function getAllPatients() external view returns (Patient[] memory) {
        require(msg.sender == admin, "Not admin");
        Patient[] memory result = new Patient[](patientAddresses.length);
        for (uint256 i = 0; i < patientAddresses.length; i++) result[i] = patients[patientAddresses[i]];
        return result;
    }

    function adminTransferPatient(address wallet, address newDoctor) external onlyAdmin {
        require(patients[wallet].exists && patients[wallet].isActive, "Invalid patient");
        require(doctorRegistry.isDoctor(newDoctor), "Invalid doctor");
        DoctorAssignment[] storage history = patientDoctorHistory[wallet];
        if (history.length > 0) history[history.length - 1].transferredDate = block.timestamp;
        history.push(DoctorAssignment(newDoctor, block.timestamp, 0, "Admin Transfer"));
        address oldDoc = patients[wallet].currentDoctor;
        patients[wallet].currentDoctor = newDoctor;
        _grantConsent(wallet, newDoctor, 0, "Primary Care - Admin Assigned");
        _logAccess(wallet, msg.sender, "ADMIN_TRANSFER", "Admin transferred", true);
        emit PatientTransferred(wallet, oldDoc, newDoctor, "Admin Transfer", block.timestamp);
    }
}
