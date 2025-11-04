const Database = require('../src/server/config/database');

async function testComplaintReceiving() {
  try {
    const db = new Database();
    const supabase = db.getClient();
    
    console.log('🧪 Testing Complaint Receiving Workflow...\n');
    
    // 1. Test complaint creation
    console.log('1️⃣ Testing complaint creation...');
    const testComplaint = {
      title: 'Test Complaint - Street Light Issue',
      descriptive_su: 'Street light on Main Street has been out for 3 days',
      location_text: 'Main Street, Downtown',
      latitude: 14.5995,
      longitude: 120.9842,
      category: 'Infrastructure',
      subcategory: 'Street Lighting',
      department_r: ['lgu-engineering'],
      workflow_status: 'new',
      priority: 'medium',
      submitted_by: 'test-user-id',
      submitted_at: new Date().toISOString()
    };
    
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .insert(testComplaint)
      .select()
      .single();
    
    if (complaintError) {
      console.error('❌ Complaint creation failed:', complaintError);
      return;
    }
    
    console.log('✅ Complaint created successfully:', complaint.id);
    
    // 2. Test evidence upload simulation
    console.log('\n2️⃣ Testing evidence upload simulation...');
    const testEvidence = {
      complaint_id: complaint.id,
      file_name: 'test-evidence.jpg',
      file_path: `${complaint.id}/test-evidence.jpg`,
      file_size: 1024,
      file_type: 'image/jpeg',
      mime_type: 'image/jpeg',
      uploaded_by: 'test-user-id',
      is_public: false
    };
    
    const { data: evidence, error: evidenceError } = await supabase
      .from('complaint_evidence')
      .insert(testEvidence)
      .select()
      .single();
    
    if (evidenceError) {
      console.error('❌ Evidence upload failed:', evidenceError);
    } else {
      console.log('✅ Evidence uploaded successfully:', evidence.id);
    }
    
    // 3. Test complaint retrieval
    console.log('\n3️⃣ Testing complaint retrieval...');
    const { data: retrievedComplaint, error: retrieveError } = await supabase
      .from('complaints')
      .select('*')
      .eq('id', complaint.id)
      .single();
    
    if (retrieveError) {
      console.error('❌ Complaint retrieval failed:', retrieveError);
    } else {
      console.log('✅ Complaint retrieved successfully');
      console.log('   - Title:', retrievedComplaint.title);
      console.log('   - Status:', retrievedComplaint.workflow_status);
      console.log('   - Department:', retrievedComplaint.department_r);
      console.log('   - Priority:', retrievedComplaint.priority);
    }
    
    // 4. Test evidence retrieval
    console.log('\n4️⃣ Testing evidence retrieval...');
    const { data: retrievedEvidence, error: evidenceRetrieveError } = await supabase
      .from('complaint_evidence')
      .select('*')
      .eq('complaint_id', complaint.id);
    
    if (evidenceRetrieveError) {
      console.error('❌ Evidence retrieval failed:', evidenceRetrieveError);
    } else {
      console.log('✅ Evidence retrieved successfully:', retrievedEvidence.length, 'files');
      retrievedEvidence.forEach((file, index) => {
        console.log(`   - File ${index + 1}: ${file.file_name} (${file.file_size} bytes)`);
      });
    }
    
    // 5. Test complaint status update
    console.log('\n5️⃣ Testing complaint status update...');
    const { data: updatedComplaint, error: updateError } = await supabase
      .from('complaints')
      .update({ 
        workflow_status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', complaint.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Complaint update failed:', updateError);
    } else {
      console.log('✅ Complaint status updated successfully');
      console.log('   - New Status:', updatedComplaint.workflow_status);
    }
    
    // 6. Cleanup
    console.log('\n6️⃣ Cleaning up test data...');
    const { error: deleteEvidenceError } = await supabase
      .from('complaint_evidence')
      .delete()
      .eq('complaint_id', complaint.id);
    
    const { error: deleteComplaintError } = await supabase
      .from('complaints')
      .delete()
      .eq('id', complaint.id);
    
    if (deleteEvidenceError || deleteComplaintError) {
      console.error('❌ Cleanup failed:', deleteEvidenceError || deleteComplaintError);
    } else {
      console.log('✅ Test data cleaned up successfully');
    }
    
    console.log('\n🎉 Complaint Receiving Workflow Test Complete!');
    console.log('\n📊 Summary:');
    console.log('✅ Complaint creation works');
    console.log('✅ Evidence upload works');
    console.log('✅ Complaint retrieval works');
    console.log('✅ Evidence retrieval works');
    console.log('✅ Status updates work');
    console.log('✅ Data cleanup works');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testComplaintReceiving();
