import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"


export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({error: "Unauthenticated"}, {status: 401})
        
        const { searchParams } = new URL(request.url)
        const month = searchParams.get("month")
        const category = searchParams.get("category")
        const type = searchParams.get("type")

        let query = supabaseAdmin
            .from("transactions")
            .select('*')
            .order("transaction_timestamp", {ascending: false})
        
        if (month) query = query.gte("transaction_timestamp", `${month}-01`)
                                .lte("transaction_timestamp", `${month}-31`)
        if (category) query = query.eq("category", category)
        if (type) query = query.eq("type", type)

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({error: error}, {status: 400})
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({error: "Unauthenticated"}, {status: 401})
        
        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month')
        const category = searchParams.get('category')
        const type = searchParams.get('type')

        if (!month && !category && !type) return NextResponse.json({error: "At least one filter required!"}, {status: 400})
        
        let query = supabaseAdmin
            .from("transactions")
            .delete()
        
        if (month) query = query.gte('transaction_timestamp', `${month}-01`)
                                .lte('transaction_timestamp', `${month}-31`)
        if (category) query = query.eq('category', category)
        if (type) query = query.eq('type', type)
        
        const { data, error } = await query
        if (error) throw error
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({error: error}, {status: 400})
    }
}