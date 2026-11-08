import sys
import json
import os
import hashlib
import hmac
import subprocess
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QTableWidget, QTableWidgetItem, QLabel, QLineEdit, QMessageBox, QHeaderView
)
from PyQt6.QtCore import Qt

DB_FILE = "licenses.json"
SECRET_KEY = b"YOUR_SUPER_SECRET_SIGNING_KEY_123!"

class LicenseManagerApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Hehe Extension - Auto-Git License Manager")
        self.resize(800, 500)
        self.setStyleSheet("""
            QMainWindow { background-color: #0f172a; color: #f1f5f9; }
            QWidget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f1f5f9; }
            QLabel { font-size: 12px; font-weight: 600; color: #94a3b8; }
            QLineEdit { 
                background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); 
                border-radius: 8px; padding: 8px 10px; color: #fff; font-size: 12px; font-family: monospace;
            }
            QLineEdit:focus { border-color: #818cf8; }
            QPushButton { 
                background: #6366f1; color: #fff; border: none; border-radius: 8px; 
                padding: 8px 14px; font-weight: 600; font-size: 12px;
            }
            QPushButton:hover { background: #4f46e5; }
            QPushButton#revokeBtn { background: #ef4444; }
            QPushButton#revokeBtn:hover { background: #dc2626; }
            QPushButton#activeBtn { background: #10b981; }
            QPushButton#activeBtn:hover { background: #059669; }
            QTableWidget { 
                background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); 
                border-radius: 12px; gridline-color: rgba(255, 255, 255, 0.05); color: #f1f5f9;
            }
            QHeaderView::section { 
                background: rgba(30, 41, 59, 0.8); color: #94a3b8; padding: 6px; 
                border: none; font-weight: bold; font-size: 11px;
            }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        # Top Form Layout
        top_controls_layout = QHBoxLayout()
        machine_box = QVBoxLayout()
        machine_box.addWidget(QLabel("USER MACHINE ID"))
        self.machine_input = QLineEdit()
        self.machine_input.setPlaceholderText("e.g. 1492-FE21-7DF9-C4D1")
        machine_box.addWidget(self.machine_input)
        top_controls_layout.addLayout(machine_box)

        btn_box = QVBoxLayout()
        btn_box.addWidget(QLabel(""))
        self.generate_btn = QPushButton("Generate Locked Key")
        self.generate_btn.clicked.connect(self.add_license)
        btn_box.addWidget(self.generate_btn)
        top_controls_layout.addLayout(btn_box)
        layout.addLayout(top_controls_layout)

        # Search Bar Layout
        search_layout = QHBoxLayout()
        search_box = QVBoxLayout()
        search_box.addWidget(QLabel("SEARCH MACHINE ID / KEY"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Type to filter...")
        self.search_input.textChanged.connect(self.filter_table)
        search_box.addWidget(self.search_input)
        search_layout.addLayout(search_box)
        layout.addLayout(search_layout)

        # Table Widget
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["Machine ID", "Cryptographic License Key", "Status", "Action"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        layout.addWidget(self.table)

        self.licenses_data = self.load_json_db()
        self.populate_table(self.licenses_data)

    def generate_key(self, machine_id: str) -> str:
        clean_id = machine_id.strip().upper()
        h = hmac.new(SECRET_KEY, clean_id.encode('utf-8'), hashlib.sha256)
        digest = h.hexdigest().upper()
        return f"{digest[0:4]}-{digest[4:8]}-{digest[8:12]}-{digest[12:16]}"

    def load_json_db(self):
        if os.path.exists(DB_FILE):
            try:
                with open(DB_FILE, "r") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        cleaned = []
                        for item in data:
                            if isinstance(item, dict):
                                mid = item.get("machine_id", "")
                                key = item.get("key") or self.generate_key(mid)
                                status = item.get("status", "Active")
                                cleaned.append({"machine_id": mid, "key": key, "status": status})
                        return cleaned
            except Exception:
                return []
        return []

    def save_json_db(self):
        try:
            with open(DB_FILE, "w") as f:
                json.dump(self.licenses_data, f, indent=4)
            
            # Write revoked list
            revoked_list = [item["key"] for item in self.licenses_data if item.get("status") == "Revoked"]
            with open("revoked.json", "w") as rf:
                json.dump(revoked_list, rf, indent=4)
                
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save JSON database: {e}")

    def auto_sync_github(self):
        """Automatically commits and pushes revoked.json to GitHub repository"""
        try:
            subprocess.run(["git", "add", "revoked.json"], check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "Auto-update revoked licenses blocklist"], check=True, capture_output=True)
            result = subprocess.run(["git", "push"], check=True, capture_output=True)
            if result.returncode == 0:
                print("Successfully pushed revoked.json to GitHub!")
        except Exception as e:
            print(f"Git auto-sync note: {e}")

    def populate_table(self, data_to_show):
        self.table.setRowCount(len(data_to_show))
        for row, item in enumerate(data_to_show):
            machine_id = item.get("machine_id", "")
            key = item.get("key", "")
            status = item.get("status", "Active")

            mid_item = QTableWidgetItem(machine_id)
            mid_item.setFlags(mid_item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 0, mid_item)

            key_item = QTableWidgetItem(key)
            key_item.setFlags(key_item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 1, key_item)

            status_item = QTableWidgetItem(status)
            status_item.setFlags(status_item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 2, status_item)

            self.set_action_buttons(row, item)

    def filter_table(self):
        query = self.search_input.text().strip().upper()
        if not query:
            self.populate_table(self.licenses_data)
            return

        filtered = [
            item for item in self.licenses_data 
            if query in item.get("machine_id", "").upper() or query in item.get("key", "").upper()
        ]
        self.populate_table(filtered)

    def add_license(self):
        machine_id = self.machine_input.text().strip().upper()
        if not machine_id:
            QMessageBox.warning(self, "Error", "Please enter the user's Machine ID.")
            return

        for item in self.licenses_data:
            if item["machine_id"] == machine_id:
                QMessageBox.warning(self, "Warning", "This Machine ID already exists in the list.")
                return

        key = self.generate_key(machine_id)
        self.licenses_data.append({
            "machine_id": machine_id,
            "key": key,
            "status": "Active"
        })
        self.save_json_db()
        self.auto_sync_github() # Syncs status change to GitHub
        self.populate_table(self.licenses_data)
        self.machine_input.clear()

    def set_action_buttons(self, row, item):
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(4, 2, 4, 2)

        status_btn = QPushButton()
        current_status = item.get("status", "Active")
        if current_status == "Active":
            status_btn.setText("Revoke")
            status_btn.setObjectName("revokeBtn")
            status_btn.clicked.connect(lambda _, m=item["machine_id"]: self.toggle_status(m, "Revoked"))
        else:
            status_btn.setText("Activate")
            status_btn.setObjectName("activeBtn")
            status_btn.clicked.connect(lambda _, m=item["machine_id"]: self.toggle_status(m, "Active"))

        layout.addWidget(status_btn)

        del_btn = QPushButton("Delete")
        del_btn.setObjectName("revokeBtn")
        del_btn.clicked.connect(lambda _, m=item["machine_id"]: self.delete_license(m))
        layout.addWidget(del_btn)

        widget.setLayout(layout)
        self.table.setCellWidget(row, 3, widget)

    def toggle_status(self, machine_id, new_status):
        for item in self.licenses_data:
            if item["machine_id"] == machine_id:
                item["status"] = new_status
                break
        self.save_json_db()
        self.auto_sync_github()  # Automatically pushes revoked.json update to GitHub!
        self.filter_table()

    def delete_license(self, machine_id):
        self.licenses_data = [item for item in self.licenses_data if item["machine_id"] != machine_id]
        self.save_json_db()
        self.auto_sync_github()  # Updates GitHub when a license is deleted
        self.filter_table()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LicenseManagerApp()
    window.show()
    sys.exit(app.exec())