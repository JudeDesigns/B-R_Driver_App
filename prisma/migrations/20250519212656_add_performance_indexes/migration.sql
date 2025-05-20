-- CreateIndex
CREATE INDEX "admin_notes_stopId_idx" ON "admin_notes"("stopId");

-- CreateIndex
CREATE INDEX "admin_notes_adminId_idx" ON "admin_notes"("adminId");

-- CreateIndex
CREATE INDEX "admin_notes_readByDriver_idx" ON "admin_notes"("readByDriver");

-- CreateIndex
CREATE INDEX "admin_notes_isDeleted_idx" ON "admin_notes"("isDeleted");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_groupCode_idx" ON "customers"("groupCode");

-- CreateIndex
CREATE INDEX "customers_isDeleted_idx" ON "customers"("isDeleted");

-- CreateIndex
CREATE INDEX "route_uploads_uploadedBy_idx" ON "route_uploads"("uploadedBy");

-- CreateIndex
CREATE INDEX "route_uploads_status_idx" ON "route_uploads"("status");

-- CreateIndex
CREATE INDEX "route_uploads_uploadedAt_idx" ON "route_uploads"("uploadedAt");

-- CreateIndex
CREATE INDEX "route_uploads_isDeleted_idx" ON "route_uploads"("isDeleted");

-- CreateIndex
CREATE INDEX "routes_routeNumber_idx" ON "routes"("routeNumber");

-- CreateIndex
CREATE INDEX "routes_date_idx" ON "routes"("date");

-- CreateIndex
CREATE INDEX "routes_status_idx" ON "routes"("status");

-- CreateIndex
CREATE INDEX "routes_driverId_idx" ON "routes"("driverId");

-- CreateIndex
CREATE INDEX "routes_isDeleted_idx" ON "routes"("isDeleted");

-- CreateIndex
CREATE INDEX "safety_checks_routeId_idx" ON "safety_checks"("routeId");

-- CreateIndex
CREATE INDEX "safety_checks_driverId_idx" ON "safety_checks"("driverId");

-- CreateIndex
CREATE INDEX "safety_checks_type_idx" ON "safety_checks"("type");

-- CreateIndex
CREATE INDEX "safety_checks_isDeleted_idx" ON "safety_checks"("isDeleted");

-- CreateIndex
CREATE INDEX "stops_routeId_idx" ON "stops"("routeId");

-- CreateIndex
CREATE INDEX "stops_customerId_idx" ON "stops"("customerId");

-- CreateIndex
CREATE INDEX "stops_status_idx" ON "stops"("status");

-- CreateIndex
CREATE INDEX "stops_driverNameFromUpload_idx" ON "stops"("driverNameFromUpload");

-- CreateIndex
CREATE INDEX "stops_isDeleted_idx" ON "stops"("isDeleted");

-- CreateIndex
CREATE INDEX "stops_sequence_idx" ON "stops"("sequence");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isDeleted_idx" ON "users"("isDeleted");
